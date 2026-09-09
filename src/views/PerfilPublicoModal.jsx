import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LOGROS_BY_SLUG } from "../lib/logros";
import { MedallaCard } from "./Medalla";
import { useT, useLang, locale } from "../lib/i18n";

/* Perfil público: solo alias + avatar + miembro desde + logros desbloqueados.
   Cero información adicional (email, favoritos, historial, etc). */
export default function PerfilPublicoModal({alias, onClose}){
  const t = useT();
  const lang = useLang();
  const [data,setData]=useState(null);
  const [err,setErr]=useState(null);

  useEffect(()=>{
    (async()=>{
      const {data:d, error} = await supabase.rpc("perfil_publico",{p_alias:alias});
      if(error){ setErr(error.message); return; }
      const row = Array.isArray(d)? d[0] : d;
      if(!row){ setErr(t("perfil.not_found")); return; }
      setData(row);
    })();
  },[alias]);

  const miembroDesde = data?.miembro_desde ? new Date(data.miembro_desde) : null;
  const logros = (data?.logros||[]).map(s=>LOGROS_BY_SLUG[s]).filter(Boolean);

  const AVATAR_PRESETS=[{k:"basketneta",e:"🏀",bg:"#f97316"},{k:"purpura",e:"👑",bg:"#9333ea"},{k:"star",e:"⭐",bg:"#eab308"},{k:"fuego",e:"🔥",bg:"#ef4444"},{k:"unicornio",e:"🦄",bg:"#ec4899"},{k:"cerebro",e:"🧠",bg:"#0ea5e9"}];
  const preset = data?.avatar?.startsWith("preset:") ? AVATAR_PRESETS.find(p=>p.k===data.avatar.slice(7)) : null;
  const url = data?.avatar && !data.avatar.startsWith("preset:") ? data.avatar : null;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <div onClick={e=>e.stopPropagation()} style={{background: "var(--fx-card)",borderRadius:"18px",maxWidth:"560px",width:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--fx-border)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background: "var(--fx-card)",zIndex:1}}>
          <div style={{fontSize:"14px",fontWeight:700,color: "var(--fx-muted)"}}>{t("perfil.title")}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color: "var(--fx-muted2)"}}>×</button>
        </div>

        {err && <div style={{padding:"30px",textAlign:"center",color:"#ef4444",fontSize:"13px"}}>{err}</div>}
        {!data && !err && <div style={{padding:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>{Array.from({length:5}).map((_,i)=><div key={i} className="bfdb-skel" style={{width:"100%",height:"40px",borderRadius:"8px"}}/>)}</div>}

        {data && (
          <>
            <div style={{padding:"22px 20px",textAlign:"center",background:"linear-gradient(180deg,#faf5ff,#fff)"}}>
              {url
                ? <img loading="lazy" decoding="async" src={url} alt="" style={{width:"96px",height:"96px",borderRadius:"50%",objectFit:"cover",border:"3px solid #9333ea"}}/>
                : preset
                  ? <div style={{width:"96px",height:"96px",borderRadius:"50%",background:preset.bg,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"46px",border:"3px solid #9333ea"}}>{preset.e}</div>
                  : <div style={{width:"96px",height:"96px",borderRadius:"50%",background:"#e2e8f0",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"40px",color: "var(--fx-muted)",border:"3px solid #cbd5e1"}}>👤</div>}
              <div style={{fontSize:"20px",fontWeight:800,color: "var(--fx-text)",marginTop:"12px"}}>{data.alias}</div>
              {miembroDesde && (
                <div style={{fontSize:"12px",color: "var(--fx-muted)",marginTop:"4px"}}>
                  {t("perfil.miembro_desde",{fecha: miembroDesde.toLocaleDateString(locale(lang),{year:"numeric",month:"long",day:"numeric"})})}
                </div>
              )}
            </div>

            <div style={{padding:"14px 20px 24px"}}>
              <div style={{fontSize:"12px",fontWeight:800,color: "var(--fx-muted)",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px"}}>
                {t("perfil.logros",{n:logros.length})}
              </div>
              {logros.length===0
                ? <div style={{padding:"24px",textAlign:"center",color: "var(--fx-muted2)",fontSize:"13px",background: "var(--fx-hover)",borderRadius:"10px"}}>{t("perfil.logros.empty")}</div>
                : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:"10px"}}>
                    {logros.map(l=>(
                      <MedallaCard key={l.slug} logro={l} size={72} dense/>
                    ))}
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
