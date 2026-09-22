import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { UserAvatar } from "../lib/avatar";
import { useT } from "../lib/i18n";
import { evento as trackEv } from "../lib/track";

const LIGA = "L001";
const TEMP = "2026-27";

const BOLA_PREGUNTAS = [
  { id: "campeon_invierno", icon: "🥶", puntos: 5, n: 1, label: "Campeón de invierno (fin 1ª vuelta)" },
  { id: "campeon_regular",  icon: "🥇", puntos: 5, n: 1, label: "Campeón de liga regular" },
  { id: "campeon_liga",     icon: "🏆", puntos: 5, n: 1, label: "Campeón de liga (playoffs)" },
  { id: "copa_reina",       icon: "🎁", puntos: 8, n: 8, label: "8 clasificadas a Copa de la Reina" },
  { id: "playoffs",         icon: "🎯", puntos: 8, n: 8, label: "8 clasificadas a Playoffs" },
];

function FlagSelect({value, options, onChange, disabled, placeholder}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find(o => o.id === value);
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nq = norm(q);
  const filtered = nq ? options.filter(o => norm(o.label).includes(nq)) : options;
  const escudo = url => url
    ? <img loading="lazy" decoding="async" src={url} alt="" style={{width:20,height:20,objectFit:"contain",flexShrink:0}}/>
    : <span style={{width:20,height:20,background:"var(--fx-border)",borderRadius:2,flexShrink:0}}/>;
  return (
    <div style={{position:"relative",flex:1,minWidth:0}}>
      <button type="button" onClick={() => !disabled && setOpen(o => { if (!o) setQ(""); return !o; })} disabled={disabled}
        style={{display:"flex",alignItems:"center",gap:"6px",width:"100%",textAlign:"left",padding:"7px 10px",fontSize:"13px",border:"1.5px solid var(--fx-border)",borderRadius:"8px",background:disabled?"var(--fx-hover)":"var(--fx-card)",cursor:disabled?"not-allowed":"pointer",color:"var(--fx-text)"}}>
        {current
          ? <>{escudo(current.flagUrl)}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,fontWeight:600}}>{current.label}</span></>
          : <span style={{color:"var(--fx-muted2)",flex:1}}>{placeholder || "—"}</span>}
        <span style={{fontSize:"10px",color:"var(--fx-muted2)"}}>▾</span>
      </button>
      {open && (<>
        <div onClick={() => setOpen(false)} style={{position:"fixed",inset:0,zIndex:30}}/>
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,minWidth:"220px",background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"8px",zIndex:31,boxShadow:"0 8px 24px rgba(0,0,0,0.2)"}}>
          {options.length >= 8 && (
            <input type="text" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…"
              style={{width:"100%",boxSizing:"border-box",padding:"7px 10px",fontSize:"12px",border:"none",borderBottom:"1px solid var(--fx-border)",outline:"none",background:"transparent",color:"var(--fx-text)"}}/>
          )}
          <div style={{maxHeight:"260px",overflowY:"auto"}}>
            <div onClick={() => { onChange(""); setOpen(false); }}
              style={{padding:"7px 10px",fontSize:"11px",color:"var(--fx-muted2)",cursor:"pointer",borderBottom:"1px solid var(--fx-border2)"}}>— sin elegir —</div>
            {filtered.map(o => (
              <div key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
                style={{display:"flex",alignItems:"center",gap:"7px",padding:"7px 10px",fontSize:"13px",cursor:"pointer",borderBottom:"1px solid var(--fx-border2)"}}
                onMouseEnter={e => e.currentTarget.style.background = "var(--fx-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {escudo(o.flagUrl)}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fx-text)"}}>{o.label}</span>
              </div>
            ))}
            {filtered.length === 0 && <div style={{padding:"12px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center"}}>Sin resultados</div>}
          </div>
        </div>
      </>)}
    </div>
  );
}

function BolaCristalEndesa({user, equipos, cierre, isAdmin}) {
  const [equiposLiga, setEquiposLiga] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const cerrado = cierre && new Date(cierre).getTime() <= Date.now();
  const [oficialesDraft, setOficialesDraft] = useState({});
  const [savingOf, setSavingOf] = useState(null);

  useEffect(() => {(async () => {
    const {data:ps} = await supabase.from("partidos")
      .select("id_equipo_local,id_equipo_visitante")
      .eq("id_liga", LIGA).eq("temporada", TEMP);
    const ids = new Set();
    (ps || []).forEach(p => { if(p.id_equipo_local) ids.add(p.id_equipo_local); if(p.id_equipo_visitante) ids.add(p.id_equipo_visitante); });
    const eqMap = {}, escMap = {};
    (equipos || []).forEach(e => { eqMap[e.id_equipo] = e.nombre; escMap[e.id_equipo] = e.escudo; });
    setEquiposLiga([...ids].map(id => ({id, nombre: eqMap[id] || id, escudo: escMap[id]})).sort((a,b) => a.nombre.localeCompare(b.nombre, "es")));
    const {data:mias} = await supabase.from("endesa_bola_predicciones")
      .select("pregunta_id,respuesta_ids").eq("user_id", user.id);
    const d = {}; (mias || []).forEach(p => { d[p.pregunta_id] = p.respuesta_ids; });
    setDrafts(d);
    if (isAdmin) {
      const {data:ofi} = await supabase.from("endesa_bola_resultados").select("pregunta_id,ids");
      const o = {}; (ofi || []).forEach(p => { o[p.pregunta_id] = p.ids; });
      setOficialesDraft(o);
    }
  })();}, [user.id, equipos, isAdmin]);

  const guardarTodo = async () => {
    if (cerrado) return;
    setSaving(true); setErr(""); setMsg("");
    let guardadas = 0;
    for (const q of BOLA_PREGUNTAS) {
      const val = (drafts[q.id] || []).filter(Boolean);
      if (val.length !== q.n) continue;
      const {error} = await supabase.rpc("endesa_bola_guardar", {p_pregunta_id: q.id, p_respuesta_ids: val});
      if (error) { setErr(error.message); setSaving(false); return; }
      guardadas++;
    }
    setSaving(false);
    setMsg(`✓ ${guardadas} pregunta${guardadas===1?"":"s"} guardada${guardadas===1?"":"s"}`);
    setTimeout(() => setMsg(""), 2500);
    trackEv("quiniela_votada", {competicion: "endesa", fase: "bola", n: guardadas});
  };

  const guardarOficial = async (q) => {
    const val = (oficialesDraft[q.id] || []).filter(Boolean);
    if (val.length !== q.n) { alert(`Debes elegir ${q.n}`); return; }
    setSavingOf(q.id);
    const {error} = await supabase.rpc("endesa_bola_admin_set", {p_pregunta_id: q.id, p_ids: val});
    setSavingOf(null);
    if (error) { alert("Error: " + error.message); return; }
    alert("Oficial guardado ✓");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{background: cerrado ? "var(--fx-amber-hover)" : "var(--fx-lila-bg)", color: cerrado ? "#92400e" : "#6b21a8", padding:"10px 14px", borderRadius:"10px", fontSize:"12px", fontWeight:600}}>
        {cerrado ? "🔒 Cerrada. La temporada ya empezó." : "⏳ Abierta hasta el inicio de la Jornada 1"}
      </div>
      {BOLA_PREGUNTAS.map(q => {
        const val = drafts[q.id] || [];
        const opts = equiposLiga.map(e => ({id: e.id, label: e.nombre, flagUrl: e.escudo}));
        return (
          <div key={q.id} style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px",gap:"8px"}}>
              <div style={{fontSize:"14px",fontWeight:800,color:"var(--fx-text)"}}>{q.icon} {q.label}</div>
              <span style={{fontSize:"11px",color:"var(--fx-muted2)",fontWeight:700,flexShrink:0}}>{q.puntos} pt{q.puntos===1?"":"s"}</span>
            </div>
            {q.n === 1 ? (
              <FlagSelect value={val[0] || ""} disabled={cerrado || opts.length === 0}
                placeholder="Elige equipo" options={opts}
                onChange={v => setDrafts(d => ({...d, [q.id]: v ? [v] : []}))}/>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"6px"}}>
                {Array.from({length: q.n}).map((_, i) => (
                  <FlagSelect key={i} value={val[i] || ""} disabled={cerrado || opts.length === 0}
                    placeholder={`#${i+1}`}
                    options={opts.filter(o => !val.includes(o.id) || o.id === val[i])}
                    onChange={v => { const nv = [...val]; nv[i] = v; setDrafts(d => ({...d, [q.id]: nv})); }}/>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!cerrado && (
        <div style={{position:"sticky",bottom:"12px",display:"flex",justifyContent:"center",gap:"12px",alignItems:"center"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"12px 22px",fontWeight:800,fontSize:"14px",cursor:saving?"wait":"pointer",boxShadow:"0 4px 12px rgba(147,51,234,0.35)"}}>
            {saving ? "Guardando…" : "Guardar todas"}
          </button>
        </div>
      )}
      {msg && <div style={{textAlign:"center",color:"#16a34a",fontSize:"13px",fontWeight:700}}>{msg}</div>}
      {err && <div style={{background:"var(--fx-red-bg)",color:"var(--fx-red-text)",padding:"10px",borderRadius:"8px",fontSize:"12px"}}>{err}</div>}

      {isAdmin && (
        <div style={{marginTop:"20px",background:"var(--fx-amber-hover)",border:"1.5px solid #fbbf24",borderRadius:"12px",padding:"14px"}}>
          <div style={{fontSize:"14px",fontWeight:800,color:"#92400e",marginBottom:"10px"}}>🛠️ Admin · Resultados oficiales</div>
          {BOLA_PREGUNTAS.map(q => {
            const val = oficialesDraft[q.id] || [];
            const opts = equiposLiga.map(e => ({id: e.id, label: e.nombre, flagUrl: e.escudo}));
            return (
              <div key={q.id} style={{background:"var(--fx-card)",borderRadius:"10px",padding:"10px 12px",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)"}}>{q.icon} {q.label}</div>
                  <button onClick={() => guardarOficial(q)} disabled={savingOf === q.id}
                    style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:"6px",padding:"5px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>
                    {savingOf === q.id ? "…" : "Guardar oficial"}
                  </button>
                </div>
                {q.n === 1 ? (
                  <FlagSelect value={val[0] || ""} disabled={false} placeholder="Equipo ganador"
                    options={opts}
                    onChange={v => setOficialesDraft(d => ({...d, [q.id]: v ? [v] : []}))}/>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"6px"}}>
                    {Array.from({length: q.n}).map((_, i) => (
                      <FlagSelect key={i} value={val[i] || ""} disabled={false} placeholder={`#${i+1}`}
                        options={opts.filter(o => !val.includes(o.id) || o.id === val[i])}
                        onChange={v => { const nv = [...val]; nv[i] = v; setOficialesDraft(d => ({...d, [q.id]: nv})); }}/>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function jornadaDeNotas(notas){
  const m = /Jornada\s+(\d+)/.exec(notas || "");
  return m ? parseInt(m[1], 10) : null;
}

function fmtFecha(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}

function VerPrediccionesEndesaModal({target, temporada, jornada, equipos, onClose}){
  const t = useT();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [partidos, setPartidos] = useState([]);

  useEffect(() => {(async () => {
    const {data, error} = await supabase.rpc("endesa_ver_predicciones_jornada",
      {p_temporada: temporada, p_jornada: jornada, p_user_id: target.user_id});
    if (error) { setErr(error.message); return; }
    setRows(data || []);
  })();}, [target.user_id, jornada, temporada]);

  useEffect(() => {(async () => {
    const {data} = await supabase.from("partidos")
      .select("id,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,fecha_hora")
      .eq("id_liga", LIGA).eq("temporada", temporada).eq("notas", "Jornada " + jornada);
    setPartidos(data || []);
  })();}, [jornada, temporada]);

  const eqMap = {};
  (equipos || []).forEach(e => { eqMap[e.id_equipo] = e.nombre; });
  const partidoById = {};
  partidos.forEach(p => { partidoById[p.id] = p; });

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px",overflowY:"auto"}}>
      <div onClick={e => e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"14px",maxWidth:"560px",width:"100%",padding:"18px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <UserAvatar avatar={target.avatar} googleUrl={target.google} nombre={target.nombre} size={40}/>
            <div>
              <div style={{fontSize:"15px",fontWeight:800,color:"var(--fx-text)"}}>{target.nombre}</div>
              <div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{t("endesa.verpred.jornada",{n:jornada})}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color:"var(--fx-muted)"}}>✕</button>
        </div>
        {err && <div style={{background:"var(--fx-red-bg)",color:"var(--fx-red-text)",padding:"10px",borderRadius:"8px",fontSize:"12px"}}>{err}</div>}
        {!rows && !err && <div style={{padding:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>{Array.from({length:5}).map((_,i)=>(<div key={i} className="bfdb-skel" style={{width:"100%",height:"52px",borderRadius:"8px"}}/>))}</div>}
        {rows && rows.length === 0 && <div style={{padding:"12px",color:"var(--fx-muted2)",fontSize:"13px"}}>{t("endesa.verpred.empty")}</div>}
        {rows && rows.length > 0 && (
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {rows.map(r => {
              const p = partidoById[r.id_partido] || {};
              const nomL = eqMap[p.id_equipo_local] || p.id_equipo_local || "—";
              const nomV = eqMap[p.id_equipo_visitante] || p.id_equipo_visitante || "—";
              const acierto = r.puntos > 0;
              return (
                <div key={r.id_partido} style={{border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"10px 12px",background: acierto ? "rgba(34,197,94,0.08)" : "var(--fx-hover)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"6px"}}>
                    <div style={{fontSize:"12px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomL} <span style={{opacity:0.6}}>vs</span> {nomV}</div>
                    {r.resultado_local != null && r.resultado_visitante != null && (
                      <div style={{fontSize:"12px",fontWeight:800,color:"var(--fx-text)"}}>{r.resultado_local}-{r.resultado_visitante}</div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    {r.pred_ganador ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"3px 10px",borderRadius:"6px",background:"var(--fx-lila-bg)",color:"#6b21a8",fontSize:"12px",fontWeight:700}}>
                        {r.pred_ganador === "L" ? "1" : "2"} · {r.pred_diferencia}
                      </span>
                    ) : (
                      <span style={{fontSize:"12px",color:"var(--fx-muted2)"}}>{t("endesa.verpred.no_pred")}</span>
                    )}
                    <span style={{marginLeft:"auto",fontSize:"13px",fontWeight:800,color: acierto ? "#16a34a" : "var(--fx-muted2)"}}>{r.puntos} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function JornadaTab({user, equipos, jornadas, jornadaN, setJornadaN, misPreds, refetchPreds}){
  const t = useT();
  const jor = jornadas.find(j => j.n === jornadaN) || {partidos:[], cierre:null};
  const cerrada = jor.cierre && new Date(jor.cierre).getTime() <= Date.now();
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = {};
    jor.partidos.forEach(p => {
      const mp = misPreds[p.id];
      d[p.id] = mp ? {ganador: mp.pred_ganador, diferencia: String(mp.pred_diferencia)} : {ganador: null, diferencia: ""};
    });
    setDrafts(d);
    setMsg(""); setErr("");
  }, [jornadaN, misPreds, jor.partidos.length]);

  const eqMap = {}, escMap = {};
  (equipos || []).forEach(e => { eqMap[e.id_equipo] = e.nombre; escMap[e.id_equipo] = e.escudo; });

  const setDraft = (id, upd) => setDrafts(prev => ({...prev, [id]: {...prev[id], ...upd}}));

  const guardarTodo = async () => {
    if (cerrada) return;
    setSaving(true); setErr(""); setMsg("");
    try {
      const filas = [];
      for (const p of jor.partidos) {
        const d = drafts[p.id] || {};
        const dif = parseInt(d.diferencia, 10);
        if (!d.ganador || !Number.isFinite(dif) || dif < 1 || dif > 199) continue;
        filas.push({id_partido: p.id, ganador: d.ganador, diferencia: dif});
      }
      for (const f of filas) {
        const {error} = await supabase.rpc("endesa_guardar_prediccion", {
          p_id_partido: f.id_partido,
          p_pred_ganador: f.ganador,
          p_pred_diferencia: f.diferencia,
        });
        if (error) throw error;
      }
      setMsg(t("endesa.saved", {n: filas.length}));
      refetchPreds();
      setTimeout(() => setMsg(""), 2200);
      trackEv("quiniela_votada", {competicion: "endesa", fase: "jornada", jornada: jornadaN, n: filas.length});
    } catch(e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const eqBtn = (id, activo, onClick) => ({
    display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1,
    background: activo ? "rgba(147,51,234,0.14)" : "var(--fx-hover)",
    border: activo ? "2px solid #9333ea" : "1.5px solid var(--fx-border)",
    borderRadius: "10px", padding: "8px 10px",
    cursor: cerrada ? "not-allowed" : "pointer",
    opacity: cerrada && !activo ? 0.6 : 1,
    transition: "all 0.15s",
  });

  const idxActual = jornadas.findIndex(j => j.n === jornadaN);
  const prev = idxActual > 0 ? jornadas[idxActual - 1] : null;
  const next = idxActual < jornadas.length - 1 ? jornadas[idxActual + 1] : null;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"12px"}}>
        <button onClick={() => prev && setJornadaN(prev.n)} disabled={!prev} style={{background:"var(--fx-hover)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"6px 10px",fontSize:"13px",color:"var(--fx-text)",cursor: prev ? "pointer" : "not-allowed",opacity: prev ? 1 : 0.4}}>←</button>
        <div style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)"}}>{t("endesa.jornada",{n:jornadaN})}</div>
        <button onClick={() => next && setJornadaN(next.n)} disabled={!next} style={{background:"var(--fx-hover)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"6px 10px",fontSize:"13px",color:"var(--fx-text)",cursor: next ? "pointer" : "not-allowed",opacity: next ? 1 : 0.4}}>→</button>
      </div>

      {cerrada && (
        <div style={{background:"var(--fx-amber-hover)",color:"#92400e",padding:"10px 12px",borderRadius:"8px",fontSize:"12px",marginBottom:"12px",fontWeight:600}}>
          🔒 {t("endesa.locked",{fecha: fmtFecha(jor.cierre)})}
        </div>
      )}
      {!cerrada && jor.cierre && (
        <div style={{background:"var(--fx-lila-bg)",color:"#6b21a8",padding:"10px 12px",borderRadius:"8px",fontSize:"12px",marginBottom:"12px",fontWeight:600}}>
          ⏳ {t("endesa.deadline",{fecha: fmtFecha(jor.cierre)})}
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {jor.partidos.map(p => {
          const d = drafts[p.id] || {ganador:null, diferencia:""};
          const jugado = p.resultado_local != null && p.resultado_visitante != null;
          return (
            <div key={p.id} style={{background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",fontSize:"11px",color:"var(--fx-muted2)",marginBottom:"8px"}}>
                <span>{fmtFecha(p.fecha_hora)}</span>
                {jugado && <span style={{fontWeight:800,color:"var(--fx-text)",fontSize:"12px"}}>{p.resultado_local}-{p.resultado_visitante}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:"6px",minWidth:0}}>
                  <button disabled={cerrada} onClick={() => setDraft(p.id,{ganador:"L"})} style={eqBtn(p.id_equipo_local, d.ganador==="L")} title={eqMap[p.id_equipo_local]}>
                    {escMap[p.id_equipo_local] && <img loading="lazy" decoding="async" src={escMap[p.id_equipo_local]} alt="" style={{width:22,height:22,objectFit:"contain",flexShrink:0}}/>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"13px",fontWeight:700,color:"var(--fx-text)",textAlign:"left"}}>{eqMap[p.id_equipo_local] || p.id_equipo_local}</span>
                  </button>
                  <span style={{fontSize:"10px",color:"var(--fx-muted2)",flexShrink:0}}>vs</span>
                  <button disabled={cerrada} onClick={() => setDraft(p.id,{ganador:"V"})} style={eqBtn(p.id_equipo_visitante, d.ganador==="V")} title={eqMap[p.id_equipo_visitante]}>
                    {escMap[p.id_equipo_visitante] && <img loading="lazy" decoding="async" src={escMap[p.id_equipo_visitante]} alt="" style={{width:22,height:22,objectFit:"contain",flexShrink:0}}/>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"13px",fontWeight:700,color:"var(--fx-text)",textAlign:"left"}}>{eqMap[p.id_equipo_visitante] || p.id_equipo_visitante}</span>
                  </button>
                </div>
                <input type="number" min="1" max="199" value={d.diferencia}
                  disabled={cerrada}
                  onChange={e => setDraft(p.id, {diferencia: e.target.value.replace(/[^\d]/g,"")})}
                  placeholder={t("endesa.diff.placeholder")}
                  style={{width:"58px",padding:"8px 6px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",fontSize:"14px",fontWeight:800,textAlign:"center",background: cerrada ? "var(--fx-hover)" : "var(--fx-card)", color:"var(--fx-text)",flexShrink:0}}/>
              </div>
            </div>
          );
        })}
      </div>

      {!cerrada && (
        <div style={{position:"sticky",bottom:"12px",marginTop:"14px",display:"flex",justifyContent:"center"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"12px 22px",fontWeight:800,fontSize:"14px",cursor: saving ? "wait" : "pointer",boxShadow:"0 4px 12px rgba(147,51,234,0.35)"}}>
            {saving ? t("endesa.saving") : t("endesa.save")}
          </button>
        </div>
      )}
      {msg && <div style={{marginTop:"10px",textAlign:"center",color:"#16a34a",fontSize:"13px",fontWeight:700}}>✓ {msg}</div>}
      {err && <div style={{marginTop:"10px",background:"var(--fx-red-bg)",color:"var(--fx-red-text)",padding:"10px",borderRadius:"8px",fontSize:"12px"}}>{err}</div>}
    </div>
  );
}

export default function EndesaView({user, equipos, onAbrirPerfil, isAdmin}){
  const t = useT();
  const [tab, setTab] = useState("jornada");
  const [jornadas, setJornadas] = useState([]);
  const [jornadaN, setJornadaN] = useState(null);
  const [misPreds, setMisPreds] = useState({});
  const [ranking, setRanking] = useState([]);
  const [verUser, setVerUser] = useState(null);
  const [verUserJornada, setVerUserJornada] = useState(1);
  const [cierreBola, setCierreBola] = useState(null);

  const cargarPreds = async () => {
    if (!user?.id) return;
    const {data} = await supabase.from("endesa_predicciones")
      .select("id_partido,pred_ganador,pred_diferencia").eq("user_id", user.id);
    const m = {}; (data || []).forEach(r => { m[r.id_partido] = r; });
    setMisPreds(m);
  };

  useEffect(() => {(async () => {
    const {data:ps} = await supabase.from("partidos")
      .select("id,notas,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante")
      .eq("id_liga", LIGA).eq("temporada", TEMP)
      .order("fecha_hora", {ascending: true});
    const byJ = new Map();
    (ps || []).forEach(p => {
      const n = jornadaDeNotas(p.notas);
      if (n == null) return;
      if (!byJ.has(n)) byJ.set(n, []);
      byJ.get(n).push(p);
    });
    const arr = [...byJ.entries()].map(([n, partidos]) => ({
      n, partidos: partidos.sort((a,b) => (a.fecha_hora||"").localeCompare(b.fecha_hora||"")),
      cierre: partidos.reduce((min, p) => (!min || (p.fecha_hora && p.fecha_hora < min)) ? p.fecha_hora : min, null),
    })).sort((a,b) => a.n - b.n);
    setJornadas(arr);
    const now = Date.now();
    const proxima = arr.find(j => j.cierre && new Date(j.cierre).getTime() > now);
    setJornadaN(proxima ? proxima.n : (arr.length ? arr[arr.length - 1].n : null));
    // Cierre de la bola = primer partido de la temporada
    setCierreBola(arr.length ? arr[0].cierre : null);
    cargarPreds();
  })();}, [user?.id]);

  useEffect(() => {
    if (tab !== "ranking") return;
    (async () => {
      const {data} = await supabase.rpc("endesa_ranking", {p_temporada: TEMP});
      setRanking(data || []);
    })();
  }, [tab]);

  const btnStyle = a => ({
    background: a ? "#9333ea" : "var(--fx-hover)",
    color: a ? "#fff" : "#64748b",
    border: a ? "none" : "1.5px solid var(--fx-border)",
    borderRadius: "10px", padding: "8px 14px", fontWeight: 700, fontSize: "13px", cursor: "pointer",
  });

  const jornadaCerradaN = useMemo(() => {
    const now = Date.now();
    for (let i = jornadas.length - 1; i >= 0; i--) {
      if (jornadas[i].cierre && new Date(jornadas[i].cierre).getTime() <= now) return jornadas[i].n;
    }
    return jornadas.length ? jornadas[0].n : 1;
  }, [jornadas]);

  return (
    <div>
      <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
        <button onClick={() => setTab("jornada")} style={btnStyle(tab==="jornada")}>{t("endesa.tab.jornada")}</button>
        <button onClick={() => setTab("bola")}    style={btnStyle(tab==="bola")}>🔮 Bola</button>
        <button onClick={() => setTab("ranking")} style={btnStyle(tab==="ranking")}>{t("endesa.tab.ranking")}</button>
      </div>

      {tab === "bola" && (
        <BolaCristalEndesa user={user} equipos={equipos} cierre={cierreBola} isAdmin={isAdmin}/>
      )}

      <div style={{background:"var(--fx-lila-bg)",color:"#6b21a8",padding:"10px 14px",borderRadius:"10px",fontSize:"12px",marginBottom:"12px",fontWeight:600,lineHeight:1.5}}>
        {t("endesa.rules")}
      </div>

      {tab === "jornada" && jornadaN != null && (
        <JornadaTab user={user} equipos={equipos} jornadas={jornadas} jornadaN={jornadaN} setJornadaN={setJornadaN} misPreds={misPreds} refetchPreds={cargarPreds}/>
      )}

      {tab === "ranking" && (
        <div style={{background:"var(--fx-card)",borderRadius:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",minWidth:"480px",borderCollapse:"collapse",fontSize:"14px"}}>
            <thead style={{background:"var(--fx-hover)"}}>
              <tr>
                <th style={{padding:"10px 12px",textAlign:"left",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>#</th>
                <th style={{padding:"10px 12px",textAlign:"left",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("endesa.rank.user")}</th>
                <th style={{padding:"10px 12px",textAlign:"center",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("endesa.rank.preds")}</th>
                <th style={{padding:"10px 12px",textAlign:"center",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("endesa.rank.hits")}</th>
                <th style={{padding:"10px 12px",textAlign:"center",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>🔮</th>
                <th style={{padding:"10px 12px",textAlign:"right",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("endesa.rank.pts")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && <tr><td colSpan={6} style={{padding:"24px",textAlign:"center",color:"var(--fx-muted2)"}}>{t("endesa.rank.empty")}</td></tr>}
              {ranking.map((r, i) => {
                const google = r.user_id === user.id ? user.user_metadata?.avatar_url : null;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <tr key={r.user_id}
                    onClick={() => { setVerUserJornada(jornadaCerradaN); setVerUser({user_id:r.user_id, nombre:r.nombre, avatar:r.avatar, google}); }}
                    style={{borderTop:"1px solid var(--fx-border2)",background: r.user_id === user.id ? "var(--fx-lila-bg)" : undefined, cursor:"pointer"}}
                    title={t("endesa.rank.view_pred")}>
                    <td style={{padding:"10px 12px",fontWeight:700,color: i===0?"#eab308": i===1?"#94a3b8": i===2?"var(--fx-amber-text)":"#64748b"}}>{medal || (i+1)}</td>
                    <td style={{padding:"8px 12px",fontWeight:600,color:"var(--fx-text)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <UserAvatar avatar={r.avatar} googleUrl={google} nombre={r.nombre} size={28}/>
                        <span onClick={e => { e.stopPropagation(); if (onAbrirPerfil && r.alias) onAbrirPerfil(r.alias); }}
                          style={{cursor: (onAbrirPerfil && r.alias) ? "pointer" : "default", textDecoration: (onAbrirPerfil && r.alias) ? "underline" : "none", textDecorationColor:"#c084fc", textUnderlineOffset:"3px"}}>
                          {r.nombre}{r.user_id === user.id ? t("endesa.rank.you") : ""}
                        </span>
                      </div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center",color:"var(--fx-muted)"}}>{r.predicciones}</td>
                    <td style={{padding:"10px 12px",textAlign:"center",color:"var(--fx-muted)"}}>{r.aciertos}</td>
                    <td style={{padding:"10px 12px",textAlign:"center",color:"var(--fx-muted)",fontWeight:700}}>{r.puntos_bola||0}</td>
                    <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:"#9333ea",fontSize:"16px"}}>{r.puntos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {verUser && (
        <VerPrediccionesEndesaModal target={verUser} temporada={TEMP} jornada={verUserJornada} equipos={equipos} onClose={() => setVerUser(null)}/>
      )}
    </div>
  );
}
