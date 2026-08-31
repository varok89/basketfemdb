import { useMemo } from "react";
import { LOGROS, CATEGORIAS, getEstadoLogros } from "../lib/logros";
import Medalla from "./Medalla";

/* Modal privado "🏆 Mis logros": grid con desbloqueados en color y bloqueados en gris. */
export default function LogrosModal({onClose}){
  const estado = getEstadoLogros();
  const desbloq = estado?.desbloqueados || new Set();

  const grupos = useMemo(()=>{
    const g = {};
    for(const l of LOGROS){
      if(!g[l.cat]) g[l.cat]=[];
      g[l.cat].push(l);
    }
    return Object.entries(g).sort((a,b)=>(CATEGORIAS[a[0]]?.orden||0)-(CATEGORIAS[b[0]]?.orden||0));
  },[]);

  const total = LOGROS.length;
  const conseguidos = LOGROS.filter(l=>desbloq.has(l.slug)).length;
  const pct = Math.round(conseguidos*100/total);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"18px",maxWidth:"720px",width:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{padding:"18px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#fff",zIndex:1}}>
          <div>
            <div style={{fontSize:"18px",fontWeight:800,color:"#1e293b"}}>🏆 Mis logros</div>
            <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px"}}>{conseguidos} / {total} · {pct}%</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color:"#94a3b8"}}>×</button>
        </div>

        <div style={{padding:"14px 20px 24px"}}>
          <div style={{background:"#f1f5f9",borderRadius:"999px",height:"8px",overflow:"hidden",marginBottom:"20px"}}>
            <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#c084fc,#f59e0b,#fde047)"}}/>
          </div>

          {grupos.map(([cat,items])=>(
            <div key={cat} style={{marginBottom:"22px"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px"}}>{CATEGORIAS[cat]?.titulo||cat}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"10px"}}>
                {items.map(l=>{
                  const ok=desbloq.has(l.slug);
                  return (
                    <div key={l.slug} title={ok?l.desc:l.pista}
                      style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:"12px",padding:"14px 10px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                      <Medalla slug={l.slug} cat={l.cat} emoji={l.emoji} size={84} locked={!ok}/>
                      <div style={{fontSize:"12px",fontWeight:700,color:ok?"#1e293b":"#94a3b8",marginTop:"4px",lineHeight:1.2}}>{l.nombre}</div>
                      <div style={{fontSize:"10px",color:"#94a3b8",lineHeight:1.25}}>{ok?l.desc:l.pista}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
