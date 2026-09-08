export const AVATAR_PRESETS=[
  {k:"basket", e:"🏀", bg:"linear-gradient(135deg,#f97316,#ea580c)"},
  {k:"star",   e:"⭐", bg:"linear-gradient(135deg,#eab308,#ca8a04)"},
  {k:"fire",   e:"🔥", bg:"linear-gradient(135deg,#ef4444,#b91c1c)"},
  {k:"target", e:"🎯", bg:"linear-gradient(135deg,#0ea5e9,#0369a1)"},
  {k:"crown",  e:"👑", bg:"linear-gradient(135deg,#a855f7,#7e22ce)"},
  {k:"gem",    e:"💎", bg:"linear-gradient(135deg,#06b6d4,#0e7490)"},
  {k:"rocket", e:"🚀", bg:"linear-gradient(135deg,#8b5cf6,#6d28d9)"},
  {k:"gold",   e:"🥇", bg:"linear-gradient(135deg,#fbbf24,#d97706)"},
  {k:"lion",   e:"🦁", bg:"linear-gradient(135deg,#f59e0b,#b45309)"},
  {k:"wolf",   e:"🐺", bg:"linear-gradient(135deg,#64748b,#334155)"},
  {k:"heart",  e:"❤️", bg:"linear-gradient(135deg,#f43f5e,#be123c)"},
  {k:"peace",  e:"✌️", bg:"linear-gradient(135deg,#10b981,#047857)"},
];

export function UserAvatar({avatar,googleUrl,nombre,size=64}){
  const preset=avatar?.startsWith("preset:")?AVATAR_PRESETS.find(p=>p.k===avatar.slice(7)):null;
  const url=avatar&&!avatar.startsWith("preset:")?avatar:(!avatar?googleUrl:null);
  const style={width:size,height:size,borderRadius:"50%",flexShrink:0};
  if(preset) return <div style={{...style,background:preset.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.55}}>{preset.e}</div>;
  if(url) return <img loading="lazy" decoding="async" src={url} alt="" style={{...style,objectFit:"cover"}}/>;
  const inicial=(nombre||"?")[0]?.toUpperCase()||"?";
  return <div style={{...style,background:"linear-gradient(135deg,#9333ea,#c084fc)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.4,fontWeight:800}}>{inicial}</div>;
}
