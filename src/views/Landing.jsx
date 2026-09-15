// src/views/Landing.jsx
// Extraído tras el fix del ReferenceError post-Fase 4 (Sentry LABASKETNETA-7, 2026-09-15).
import { useT, locale } from "../lib/i18n";

function Landing({onEnter,players,equipos,ligas,coaches,tempCoach,palmares,regExtra}){
  const t = useT();
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:"20px"}}>
      <div style={{maxWidth:"560px",width:"100%",textAlign:"center"}}>
        <div style={{marginBottom:"28px"}}>
          <img src="/icon-home.png" alt="La Basketneta" style={{height:"120px",objectFit:"contain"}}/>
        </div>
        <div style={{fontSize:"14px",color:"var(--fx-muted2)",marginBottom:"36px",fontWeight:500}}>{t("landing.tagline")}</div>
        {players&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"16px 20px",marginBottom:"16px",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontWeight:700,fontSize:"12px",color:"var(--fx-muted2)",marginBottom:"12px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{t("landing.stats_title")}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px"}}>
            {[["👩‍🏀",(players||[]).length,t("landing.stats.jugadoras")],["🏟️",(equipos||[]).length,t("landing.stats.equipos")],["🏆",(ligas||[]).length,t("landing.stats.ligas")],["🗂️",((players||[]).length+(equipos||[]).length+(ligas||[]).length+(coaches||[]).length+(tempCoach||[]).length+(palmares||[]).length+(regExtra||0)).toLocaleString(locale()),t("landing.stats.registros")]].map(([icon,val,label])=>(
              <div key={label} style={{textAlign:"center",padding:"8px 4px"}}>
                <div style={{fontSize:"14px"}}>{icon}</div>
                <div style={{fontSize:"18px",fontWeight:800,color:"#f1f5f9"}}>{typeof val==="number"?val.toLocaleString(locale()):val}</div>
                <div style={{fontSize:"10px",color:"var(--fx-muted)"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"16px 20px",marginBottom:"24px",border:"1px solid rgba(255,255,255,0.07)",textAlign:"left"}}>
          <div style={{fontWeight:700,fontSize:"12px",color:"var(--fx-muted2)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{t("landing.legal_title")}</div>
          <p style={{fontSize:"12px",color:"var(--fx-muted)",lineHeight:"1.6",margin:0}}>
            {(()=>{const raw=t("landing.legal_body",{mail:"__MAIL__"});const [a,b]=raw.split("__MAIL__");return<>{a}<span style={{color:"#9333ea",fontWeight:600}}>labasketneta@gmail.com</span>{b}</>;})()}
          </p>
        </div>
        <button onClick={onEnter}
          style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"14px",padding:"14px 40px",fontSize:"15px",fontWeight:800,cursor:"pointer",width:"100%",letterSpacing:"0.3px",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#7c3aed"}
          onMouseLeave={e=>e.currentTarget.style.background="#9333ea"}>
          {t("landing.enter")}
        </button>
        <div style={{fontSize:"11px",color:"var(--fx-label)",marginTop:"12px"}}>
          {t("landing.accept")}
        </div>
      </div>
    </div>
  );
}

export default Landing;
