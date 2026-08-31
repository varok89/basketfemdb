import { supabase } from "./supabaseClient";

/* Catálogo de logros. Cada logro tiene:
   - slug: PK en BD
   - cat: categoría para agrupar en UI
   - emoji, nombre, desc, pista
   - evento: string que dispara la evaluación
   - clave: progreso key donde se acumula (null = evento directo)
   - check(valor, ctx) -> bool: si desbloquea */

export const CATEGORIAS = {
  bienvenida:    { orden: 0, titulo: "Bienvenida" },
  exploracion:   { orden: 1, titulo: "Exploración" },
  quiniela:      { orden: 2, titulo: "Quiniela" },
  fidelidad:     { orden: 3, titulo: "Fidelidad" },
  coleccionismo: { orden: 4, titulo: "Coleccionismo" },
  secretos:      { orden: 5, titulo: "Secretos" },
};

export const LOGROS = [
  // ── Bienvenida ────────────────────────────────────
  { slug:"bienvenida", cat:"bienvenida", emoji:"🚌",
    nombre:"Yo también voy en LaBasketneta",
    desc:"Te uniste a la comunidad.",
    pista:"Regístrate para conseguirlo.",
    evento:"login", clave:null, check:()=>true },

  // ── Exploración ───────────────────────────────────
  { slug:"primer_paso", cat:"exploracion", emoji:"👣",
    nombre:"Primer paso", desc:"Visita 5 secciones distintas.",
    pista:"Curiosea las pestañas de la app.",
    evento:"visita_tab", clave:"tabs_set",
    check:v=>(v?.set||[]).length>=5 },

  { slug:"curioso", cat:"exploracion", emoji:"👀",
    nombre:"Curioso", desc:"Visita 10 perfiles de jugadora.",
    pista:"Abre fichas de jugadoras.",
    evento:"visita_jugadora", clave:"jugadoras_set",
    check:v=>(v?.set||[]).length>=10 },

  { slug:"ojeador", cat:"exploracion", emoji:"🔭",
    nombre:"Ojeador", desc:"Visita 25 perfiles de equipo.",
    pista:"Abre fichas de equipos.",
    evento:"visita_equipo", clave:"equipos_set",
    check:v=>(v?.set||[]).length>=25 },

  { slug:"trotamundos", cat:"exploracion", emoji:"🌍",
    nombre:"Trotamundos", desc:"Visita jugadoras de 10 ligas distintas.",
    pista:"Explora ligas de países diferentes.",
    evento:"visita_liga", clave:"ligas_set",
    check:v=>(v?.set||[]).length>=10 },

  { slug:"fan_banquillo", cat:"exploracion", emoji:"🎽",
    nombre:"Fan del banquillo", desc:"Visita 20 perfiles de coach.",
    pista:"Los entrenadores también cuentan.",
    evento:"visita_coach", clave:"coaches_set",
    check:v=>(v?.set||[]).length>=20 },

  // ── Quiniela ──────────────────────────────────────
  { slug:"debut_quinielero", cat:"quiniela", emoji:"🎯",
    nombre:"Debut quinielero", desc:"Guarda tu primera predicción.",
    pista:"Ve a la pestaña Quiniela.",
    evento:"prediccion", clave:"predicciones_count",
    check:v=>(v?.count||0)>=1 },

  { slug:"perfeccionista", cat:"quiniela", emoji:"💯",
    nombre:"Perfeccionista", desc:"Clava 5 marcadores exactos.",
    pista:"Adivina el resultado exacto de partidos.",
    evento:"exacto", clave:"exactos_count",
    check:v=>(v?.count||0)>=5 },

  { slug:"racha_caliente", cat:"quiniela", emoji:"🔥",
    nombre:"Racha caliente", desc:"Acierta el ganador de 10 partidos seguidos.",
    pista:"No falles ni uno.",
    evento:"acierto_ganador", clave:"racha_ganador",
    check:v=>(v?.best||0)>=10 },

  { slug:"analista", cat:"quiniela", emoji:"📊",
    nombre:"Analista", desc:"Predice 50 partidos en una temporada.",
    pista:"Cantidad también importa.",
    evento:"prediccion", clave:"predicciones_count",
    check:v=>(v?.count||0)>=50 },

  { slug:"top3", cat:"quiniela", emoji:"🥉",
    nombre:"Top 3", desc:"Termina en el podio de una quiniela de torneo.",
    pista:"Mundial, Euroliga… demuestra que sabes.",
    evento:"podio_torneo", clave:null, check:()=>true },

  // ── Fidelidad ─────────────────────────────────────
  { slug:"habitual", cat:"fidelidad", emoji:"📅",
    nombre:"Habitual", desc:"Entra 7 días seguidos.",
    pista:"Vuelve cada día.",
    evento:"login", clave:"login_racha",
    check:v=>(v?.best||0)>=7 },

  { slug:"season_pass", cat:"fidelidad", emoji:"🎟️",
    nombre:"Season pass", desc:"Activo durante una temporada completa (6 meses distintos).",
    pista:"La regularidad tiene premio.",
    evento:"login", clave:"login_meses",
    check:v=>(v?.set||[]).length>=6 },

  { slug:"veterano", cat:"fidelidad", emoji:"🎖️",
    nombre:"Veterano", desc:"Un año en LaBasketneta.",
    pista:"Se desbloquea solo con el tiempo.",
    evento:"login", clave:null,
    check:(_,p)=>(p?.antiguedad_dias||0)>=365 },

  { slug:"dia_partido", cat:"fidelidad", emoji:"📺",
    nombre:"Día de partido", desc:"Abre la app en 10 días con partidos WNBA/LF/Euroliga.",
    pista:"Coincide con la jornada.",
    evento:"login_dia_partido", clave:"dias_partido_set",
    check:v=>(v?.set||[]).length>=10 },

  // ── Coleccionismo ────────────────────────────────
  { slug:"favoritos", cat:"coleccionismo", emoji:"⭐",
    nombre:"Favoritos", desc:"Marca 10 jugadoras favoritas.",
    pista:"El corazoncito de las fichas.",
    evento:"fav_jugadora", clave:"fav_jugadoras_set",
    check:v=>(v?.set||[]).length>=10 },

  { slug:"fan_declarado", cat:"coleccionismo", emoji:"🏳️",
    nombre:"Fan declarado", desc:"Sigue a 5 equipos.",
    pista:"Añade equipos a favoritos.",
    evento:"fav_equipo", clave:"fav_equipos_set",
    check:v=>(v?.set||[]).length>=5 },

  { slug:"multiligas", cat:"coleccionismo", emoji:"🌐",
    nombre:"Multiligas", desc:"Sigue equipos de 3 ligas distintas.",
    pista:"Amplía miras.",
    evento:"fav_equipo_liga", clave:"fav_equipos_ligas_set",
    check:v=>(v?.set||[]).length>=3 },

  // ── Secretos ─────────────────────────────────────
  { slug:"fan_de_x", cat:"secretos", emoji:"💜",
    nombre:"Fan de...", desc:"Visita el perfil de una misma jugadora 10 veces.",
    pista:"Alguien te tiene enamorada.",
    evento:"visita_jugadora", clave:"visitas_por_jugadora",
    check:v=>Object.values(v?.map||{}).some(n=>n>=10) },

  { slug:"noctambulo", cat:"secretos", emoji:"🌙",
    nombre:"Noctámbulo", desc:"Usa la app entre las 3 y las 5 de la mañana.",
    pista:"El sueño es para débiles.",
    evento:"login", clave:null,
    check:()=>{ const h=new Date().getHours(); return h>=3 && h<5; } },

  { slug:"madrugador", cat:"secretos", emoji:"⏰",
    nombre:"Al tip-off", desc:"Abre la app en los primeros 5 minutos de un partido en vivo.",
    pista:"Puntualidad de reloj suizo.",
    evento:"login_tipoff", clave:null, check:()=>true },
];

export const LOGROS_BY_SLUG = Object.fromEntries(LOGROS.map(l=>[l.slug,l]));

/* ── Runtime ─────────────────────────────────────── */
let _estado = null;
const _listeners = new Set();

export function onLogroDesbloqueado(fn){ _listeners.add(fn); return ()=>_listeners.delete(fn); }
function _emit(logro){ _listeners.forEach(fn=>{ try{fn(logro);}catch{} }); }

export async function initLogros(user){
  if(!user){ _estado=null; return null; }
  const [{data:d}, {data:p}, {count:cbn}, {count:cbo}] = await Promise.all([
    supabase.from("logros_usuario").select("slug_logro").eq("id_usuario",user.id),
    supabase.from("logros_progreso").select("clave,valor").eq("id_usuario",user.id),
    supabase.from("basketneta_predicciones").select("*",{count:"exact",head:true}).eq("user_id",user.id),
    supabase.from("bola_cristal_predicciones").select("*",{count:"exact",head:true}).eq("user_id",user.id),
  ]);
  const progreso = {};
  (p||[]).forEach(r=>{ progreso[r.clave]=r.valor; });
  // Recount predicciones reales (fuente de verdad = tablas de predicciones)
  const totalPred = (cbn||0)+(cbo||0);
  if(totalPred>0) progreso.predicciones_count = { count: totalPred };
  const antiguedad = user.created_at ? Math.floor((Date.now()-new Date(user.created_at).getTime())/86400000) : 0;
  _estado = {
    userId: user.id,
    desbloqueados: new Set((d||[]).map(r=>r.slug_logro)),
    progreso,
    antiguedadDias: antiguedad,
  };
  // Persistir recount si difiere
  if(totalPred>0){
    await supabase.from("logros_progreso").upsert({
      id_usuario: user.id, clave:"predicciones_count",
      valor: progreso.predicciones_count, actualizado_en: new Date().toISOString(),
    }, { onConflict:"id_usuario,clave" });
  }
  return _estado;
}

export function getEstadoLogros(){ return _estado; }

function _mutar(valorPrev, tipo, payload){
  const v = valorPrev ? {...valorPrev} : {};
  if(tipo==="add_set"){
    const s = new Set(v.set||[]); s.add(payload); v.set=[...s];
  } else if(tipo==="inc"){
    v.count = (v.count||0) + (payload?.n || 1);
  } else if(tipo==="racha"){
    const hoy = payload.hoy;
    if(v.last===hoy) return v;
    const ayer = new Date(new Date(hoy).getTime()-86400000).toISOString().slice(0,10);
    const actual = (v.last===ayer ? (v.actual||0) : 0) + 1;
    v.actual=actual; v.best=Math.max(v.best||0,actual); v.last=hoy;
  } else if(tipo==="racha_ganador"){
    if(payload.acierto){ v.actual=(v.actual||0)+1; v.best=Math.max(v.best||0,v.actual); }
    else v.actual=0;
  } else if(tipo==="map_inc"){
    const m={...(v.map||{})}; m[payload]=(m[payload]||0)+1; v.map=m;
  }
  return v;
}

async function _persistProgreso(clave, valor){
  if(!_estado) return;
  _estado.progreso[clave] = valor;
  await supabase.from("logros_progreso").upsert({
    id_usuario: _estado.userId, clave, valor, actualizado_en: new Date().toISOString(),
  }, { onConflict: "id_usuario,clave" });
}

async function _desbloquear(slug){
  if(!_estado || _estado.desbloqueados.has(slug)) return null;
  const logro = LOGROS_BY_SLUG[slug];
  if(!logro) return null;
  _estado.desbloqueados.add(slug);
  const { error } = await supabase.from("logros_usuario").insert({
    id_usuario: _estado.userId, slug_logro: slug,
  });
  if(error){ _estado.desbloqueados.delete(slug); return null; }
  _emit(logro);
  return logro;
}

/* Registra evento. Ver README/comentarios en cada logro para el shape de payload. */
export async function registrarEvento(tipo, payload){
  if(!_estado) return [];
  const candidatos = LOGROS.filter(l=>l.evento===tipo);
  if(candidatos.length===0) return [];
  const clavesAActualizar = new Map();

  for(const logro of candidatos){
    if(!logro.clave) continue;
    if(_estado.desbloqueados.has(logro.slug)) continue;
    if(clavesAActualizar.has(logro.clave)) continue;

    const prev = _estado.progreso[logro.clave];
    let nuevo = prev;
    if(tipo==="visita_tab")            nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="visita_jugadora"){
      if(logro.clave==="jugadoras_set") nuevo = _mutar(prev,"add_set", payload?.id);
      else if(logro.clave==="visitas_por_jugadora") nuevo = _mutar(prev,"map_inc", payload?.id);
    }
    else if(tipo==="visita_equipo")    nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="visita_liga")      nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="visita_coach")     nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="fav_jugadora")     nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="fav_equipo")       nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="fav_equipo_liga")  nuevo = _mutar(prev,"add_set", payload);
    else if(tipo==="prediccion")       nuevo = _mutar(prev,"inc", {n: payload?.n||1});
    else if(tipo==="exacto")           nuevo = _mutar(prev,"inc", {n: payload?.n||1});
    else if(tipo==="acierto_ganador")  nuevo = _mutar(prev,"racha_ganador", payload);
    else if(tipo==="login" && logro.clave==="login_racha")
      nuevo = _mutar(prev,"racha",{hoy:new Date().toISOString().slice(0,10)});
    else if(tipo==="login" && logro.clave==="login_meses")
      nuevo = _mutar(prev,"add_set", new Date().toISOString().slice(0,7));
    else if(tipo==="login_dia_partido")
      nuevo = _mutar(prev,"add_set", payload);

    if(nuevo !== prev) clavesAActualizar.set(logro.clave, nuevo);
  }

  await Promise.all([...clavesAActualizar.entries()].map(([k,v])=>_persistProgreso(k,v)));

  const nuevos = [];
  const ctx = { antiguedad_dias: _estado.antiguedadDias };
  for(const logro of candidatos){
    if(_estado.desbloqueados.has(logro.slug)) continue;
    const valor = logro.clave ? _estado.progreso[logro.clave] : null;
    let ok=false;
    try{ ok = logro.check(valor, ctx); }catch{ ok=false; }
    if(ok){
      const r = await _desbloquear(logro.slug);
      if(r) nuevos.push(r);
    }
  }
  return nuevos;
}
