import { useId } from "react";

const COLORES = {
  bienvenida:    {c1:"#fecaca", c2:"#dc2626", c3:"#7f1d1d"},
  exploracion:   {c1:"#bbf7d0", c2:"#16a34a", c3:"#14532d"},
  quiniela:      {c1:"#ddd6fe", c2:"#7c3aed", c3:"#3b0764"},
  fidelidad:     {c1:"#bfdbfe", c2:"#2563eb", c3:"#1e3a8a"},
  coleccionismo: {c1:"#fbcfe8", c2:"#ec4899", c3:"#831843"},
  secretos:      {c1:"#334155", c2:"#0f172a", c3:"#020617"},
};

/* Medalla clásica: disco esmaltado con láurel grabado, emoji en relieve. */
export default function Medalla({ slug, cat, emoji, size = 96, locked = false }){
  const col = COLORES[cat] || COLORES.bienvenida;
  const uid = useId();
  const gid = `mg_${uid}`;
  const eid = `me_${uid}`;
  const fid = `mf_${uid}`;

  const laurel = [];
  for(let i=0;i<24;i++){
    const a = (i/24)*Math.PI*2;
    const x1 = 60+Math.cos(a)*36, y1 = 60+Math.sin(a)*36;
    const x2 = 60+Math.cos(a)*40, y2 = 60+Math.sin(a)*40;
    laurel.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={col.c3} strokeOpacity="0.65" strokeWidth="0.9" strokeLinecap="round"/>
    );
  }

  return (
    <svg viewBox="0 0 120 120" width={size} height={size}
      style={{display:"block", filter: locked
        ? "grayscale(1) opacity(0.35) drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
        : "drop-shadow(0 6px 10px rgba(0,0,0,0.18))"}}>
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="80%">
          <stop offset="0%"  stopColor={col.c1}/>
          <stop offset="55%" stopColor={col.c2}/>
          <stop offset="100%" stopColor={col.c3}/>
        </radialGradient>
        <radialGradient id={eid} cx="50%" cy="50%" r="55%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.55)"/>
          <stop offset="70%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
        <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
          <feOffset in="SourceAlpha" dx="0" dy="-0.8" result="hiA"/>
          <feFlood floodColor="rgba(255,255,255,0.75)"/>
          <feComposite in2="hiA" operator="in" result="hi"/>
          <feOffset in="SourceAlpha" dx="0" dy="1.2" result="shA"/>
          <feGaussianBlur in="shA" stdDeviation="0.4" result="shB"/>
          <feFlood floodColor="rgba(0,0,0,0.55)"/>
          <feComposite in2="shB" operator="in" result="sh"/>
          <feMerge>
            <feMergeNode in="hi"/>
            <feMergeNode in="sh"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <circle cx="60" cy="60" r="56" fill={`url(#${gid})`} stroke={col.c3} strokeWidth="1.8"/>
      <circle cx="60" cy="60" r="48" fill="none" stroke={col.c3} strokeOpacity="0.45" strokeWidth="0.9"/>
      <circle cx="60" cy="60" r="44" fill="none" stroke={col.c1} strokeOpacity="0.55" strokeWidth="0.6"/>
      {laurel}

      <g filter={`url(#${fid})`}>
        <text x="60" y="76" textAnchor="middle" fontSize="52"
          fontFamily="system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'">
          {locked ? "🔒" : emoji}
        </text>
      </g>

      <ellipse cx="44" cy="40" rx="26" ry="14" fill={`url(#${eid})`}/>
    </svg>
  );
}

export function MedallaCard({ logro, conseguido = true, size = 84, showDesc = false, dense = false }){
  const pad = dense ? "12px 8px" : "14px 10px";
  const gap = dense ? "4px" : "6px";
  const nameFont = dense ? "11px" : "12px";
  const nameMargin = dense ? "3px" : "4px";
  return (
    <div title={conseguido ? logro.desc : logro.pista}
      style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:"12px",padding:pad,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap}}>
      <Medalla slug={logro.slug} cat={logro.cat} emoji={logro.emoji} size={size} locked={!conseguido}/>
      <div style={{fontSize:nameFont,fontWeight:700,color:conseguido?"#1e293b":"#94a3b8",marginTop:nameMargin,lineHeight:1.2}}>{logro.nombre}</div>
      {showDesc && <div style={{fontSize:"10px",color:"#94a3b8",lineHeight:1.25}}>{conseguido?logro.desc:logro.pista}</div>}
    </div>
  );
}
