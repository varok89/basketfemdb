import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase, callFn } from "../lib/supabaseClient";
import { COUNTRY_CODES, countryCode, flagEmoji, NO_COUNTRY_FLAGS, checkIdGaps, FibaRow } from "../lib/utils";

function CalidadModal({players,equipos,ligas,coaches,tempCoach,palmares,onClose,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach,onReload,isAdmin,setPlayers,setEquipos,setLigas,setCoaches,setTempCoach}){
  var tabState=useState("incompletas");
  var tab=tabState[0];var setTab=tabState[1];
  // ── Estado del sistema (pestaña Ops) ──
  var [estadoData,setEstadoData]=useState(null);
  var [estadoBusy,setEstadoBusy]=useState(false);
  var [estadoErr,setEstadoErr]=useState("");
  var [nacFixing,setNacFixing]=useState(null);
  async function cargarEstado(){
    setEstadoBusy(true);setEstadoErr("");
    try{
      var r=await fetch("/api/estado-sistema");
      var j=await r.json();
      if(!r.ok)throw new Error(j.error||"error");
      setEstadoData(j);
    }catch(e){setEstadoErr(e.message);}
    setEstadoBusy(false);
  }
  // ── Scraper FIBA (rellena boxscores desde el play-by-play vía Edge Function) ──
  var scLigaState=useState("");var scLiga=scLigaState[0];var setScLiga=scLigaState[1];
  // Carreras ESPN por equipo (NCAA + WNBA)
  var [carrLiga,setCarrLiga]=useState("L020");
  var [carrTemp,setCarrTemp]=useState("2025-26");
  var [carrEquipoId,setCarrEquipoId]=useState("");
  var [carrInfo,setCarrInfo]=useState(null);
  var [carrBusy,setCarrBusy]=useState("");
  var [carrLog,setCarrLog]=useState([]);
  useEffect(()=>{setCarrTemp(carrLiga==="L006"?"2026":"2025-26");setCarrEquipoId("");setCarrInfo(null);setCarrLog([]);},[carrLiga]);
  var [carrEquiposLiga,setCarrEquiposLiga]=useState([]);
  // Modo liga completa
  var [ligaInfo,setLigaInfo]=useState(null); // [{equipo, id_equipo, bd_total, espn_total, mapeados, solo_en_espn_obj, roster}]
  var [ligaProgress,setLigaProgress]=useState({done:0,total:0,paso:""});
  var [skipCargadas,setSkipCargadas]=useState(true);
  useEffect(()=>{
    if(tab!=="carreras"||!carrLiga||!carrTemp)return;
    (async()=>{
      const ids=new Set();let from=0;
      while(true){
        const {data}=await supabase.from("temporadas").select("id_equipo").eq("id_liga",carrLiga).eq("temporada",carrTemp).range(from,from+999);
        if(!data||!data.length)break;
        data.forEach(t=>ids.add(t.id_equipo));
        if(data.length<1000)break;
        from+=1000;
      }
      if(!ids.size){setCarrEquiposLiga([]);return;}
      const isFeb=["L001","L002","L003","L017","L074"].includes(carrLiga);
      const isFiba=["L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga);
      const extCol=["L007","L022","L098"].includes(carrLiga)?"id_lfb":(isFeb?"id_ext":(isFiba?"id_fiba":"id_espn"));
      const {data:eqs}=await supabase.from("equipos").select("id_equipo,nombre,"+extCol).in("id_equipo",[...ids]).not(extCol,"is",null);
      const arr=(eqs||[]).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||""));
      setCarrEquiposLiga(arr);
    })();
  },[tab,carrLiga,carrTemp]);

  // Fallback local: reconstruye el roster BD sin llamar a ningún edge.
  // Se usa cuando el edge (mapear-roster-lfb, mapear-roster-espn) falla o no
  // existe para esa liga. Devuelve mismo shape que los edges.
  async function rosterLocalFallback(id_equipo,id_liga,temporada){
    const extField=["L007","L022","L098"].includes(id_liga)?"id_lfb"
                  :["L001","L002","L003","L017","L074"].includes(id_liga)?"id_ext"
                  :["L020","L006"].includes(id_liga)?"id_espn"
                  :"fiba_person_id";
    const {data:eqRow}=await supabase.from("equipos").select("nombre").eq("id_equipo",id_equipo).single();
    const {data:temps}=await supabase.from("temporadas").select("id_jugadora,jugadoras(nombre,"+extField+")").eq("id_equipo",id_equipo).eq("id_liga",id_liga).eq("temporada",temporada);
    const roster=(temps||[]).map(function(t){
      var ext=t.jugadoras?.[extField]||null;
      return {id_jugadora:t.id_jugadora,nombre:t.jugadoras?.nombre||t.id_jugadora,id_espn:ext};
    }).sort(function(a,b){return (a.nombre||"").localeCompare(b.nombre||"");});
    const conExt=roster.filter(function(r){return r.id_espn;}).length;
    return {equipo:eqRow?.nombre||id_equipo,bd_total:roster.length,espn_total:conExt,ya_con_espn:conExt,mapeados:0,roster:roster,solo_en_espn_obj:[],_fallback:true};
  }

  async function carrAnalizar(){
    if(!carrEquipoId){alert("Selecciona un equipo");return;}
    setCarrBusy("info");setCarrInfo(null);setCarrLog([]);
    try{
      const isFeb=["L001","L002","L003","L017","L074"].includes(carrLiga);
      const isFiba=["L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga);
      const fn=["L007","L022","L098"].includes(carrLiga)?"mapear-roster-lfb"
              :(isFeb||isFiba)?null:"mapear-roster-espn";
      let res=null;
      if(fn){
        try{ res=await callFn(fn,{id_equipo:carrEquipoId,id_liga:carrLiga,temporada:carrTemp,dry:true}); }catch(e){ res={error:e.message}; }
      }
      if(!res||res.error||res.ok===false){
        const fb=await rosterLocalFallback(carrEquipoId,carrLiga,carrTemp);
        setCarrInfo({...fb,_edge_error:res?.error||res?.motivo||(fn?"edge no disponible":null)});
      } else setCarrInfo(res);
    }catch(e){setCarrInfo({error:e.message});}
    setCarrBusy("");
  }
  async function carrMapear(){
    setCarrBusy("mapear");
    try{
      const fn=["L007","L022","L098"].includes(carrLiga)?"mapear-roster-lfb":"mapear-roster-espn";
      setCarrInfo(await callFn(fn,{id_equipo:carrEquipoId,id_liga:carrLiga,temporada:carrTemp,dry:false}));
    }catch(e){setCarrInfo({error:e.message});}
    setCarrBusy("");
  }
  // ── Modo liga completa: recorre TODOS los equipos de la liga+temp seleccionada ──
  async function ligaAnalizar(){
    if(!carrEquiposLiga.length){alert("No hay equipos");return;}
    setCarrBusy("liga_info");setLigaInfo(null);setCarrLog([]);
    var out=[];
    for(var i=0;i<carrEquiposLiga.length;i++){
      var eq=carrEquiposLiga[i];
      setLigaProgress({done:i,total:carrEquiposLiga.length,paso:"Analizando "+eq.nombre});
      try{
        const isFebL=["L001","L002","L003","L017","L074"].includes(carrLiga);
        const isFibaL=["L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga);
        const fn=["L007","L022","L098"].includes(carrLiga)?"mapear-roster-lfb"
                :(isFebL||isFibaL)?null:"mapear-roster-espn";
        let jr=null;
        if(fn){ try{ jr=await callFn(fn,{id_equipo:eq.id_equipo,id_liga:carrLiga,temporada:carrTemp,dry:true}); }catch(er){ jr={error:er.message}; } }
        if(!jr||jr.error||jr.ok===false){
          const fb=await rosterLocalFallback(eq.id_equipo,carrLiga,carrTemp);
          out.push({id_equipo:eq.id_equipo,equipo:eq.nombre,bd_total:fb.bd_total,espn_total:fb.espn_total,mapeados:0,solo_en_espn_obj:[],roster:fb.roster,_edge_error:jr?.error||jr?.motivo||(fn?"edge no disponible":null)});
        } else {
          out.push({id_equipo:eq.id_equipo,equipo:eq.nombre,bd_total:jr.bd_total||0,espn_total:jr.espn_total||0,mapeados:jr.mapeados||0,solo_en_espn_obj:jr.solo_en_espn_obj||[],roster:jr.roster||[]});
        }
      }catch(e){out.push({id_equipo:eq.id_equipo,equipo:eq.nombre,error:e.message});}
    }
    setLigaProgress({done:carrEquiposLiga.length,total:carrEquiposLiga.length,paso:"Análisis completo"});
    setLigaInfo(out);
    setCarrBusy("");
  }
  async function ligaCrearYMapear(){
    if(!ligaInfo)return;
    var totalCrear=ligaInfo.reduce((a,e)=>a+(e.solo_en_espn_obj?.length||0),0);
    var totalMapear=ligaInfo.reduce((a,e)=>a+(e.mapeados||0),0);
    if(!totalCrear&&!totalMapear){alert("Nada que hacer");return;}
    if(!confirm("Mapear "+totalMapear+" id_espn y crear "+totalCrear+" jugadoras nuevas repartidas en "+ligaInfo.length+" equipos?"))return;
    setCarrBusy("liga_crear");
    var out=[];
    for(var i=0;i<ligaInfo.length;i++){
      var eq=ligaInfo[i];
      if(eq.error){out.push(eq);continue;}
      setLigaProgress({done:i,total:ligaInfo.length,paso:"Creando en "+eq.equipo});
      try{
        const fn=["L007","L022","L098"].includes(carrLiga)?"mapear-roster-lfb":"mapear-roster-espn";
        var j=await callFn(fn,{id_equipo:eq.id_equipo,id_liga:carrLiga,temporada:carrTemp,dry:false,crear_faltantes:true});
        out.push({id_equipo:eq.id_equipo,equipo:eq.nombre,bd_total:j.bd_total||0,espn_total:j.espn_total||0,mapeados:j.mapeados||0,solo_en_espn_obj:j.solo_en_espn_obj||[],roster:j.roster||[],creadas:j.total_creadas||0,adjuntadas:j.total_adjuntadas||0});
      }catch(e){out.push({id_equipo:eq.id_equipo,equipo:eq.nombre,error:e.message});}
    }
    setLigaProgress({done:ligaInfo.length,total:ligaInfo.length,paso:"Creación completa"});
    setLigaInfo(out);
    setCarrBusy("");
    alert("Listo: "+out.reduce((a,e)=>a+(e.creadas||0),0)+" creadas · "+out.reduce((a,e)=>a+(e.adjuntadas||0),0)+" adjuntadas");
  }
  async function mapearIdExtFeb(){
    var FEB_LIGAS=["L001","L002","L003","L017","L074"];
    if(!FEB_LIGAS.includes(carrLiga)){alert("Solo disponible para ligas FEB (L001/L002/L003/L017/L074)");return;}
    if(!confirm("Mapear id_ext_feb de "+carrLiga+" "+carrTemp+"? Scrapeará 1 partido por cada grupo de jugadoras sin id_ext_feb (típico 50-200 requests, retry+cache absorben rate limit)."))return;
    setCarrBusy("mapear_ie_feb");
    setLigaProgress({done:0,total:1,paso:"Mapeando id_ext_feb..."});
    try{
      const j=await callFn("mapear-id-ext-feb-batch",{id_liga:carrLiga,temporada:carrTemp,dry:false});
      if(j.ok===false||j.error){alert("Fallo: "+(j.error||j.motivo||"desconocido"));return;}
      const msg="✅ Mapeadas "+(j.jugadoras_mapeadas||0)+" jugadoras de "+(j.total_candidatas||0)+" candidatas · "+(j.partidos_scrapeados_ok||0)+"/"+(j.partidos_unicos||0)+" partidos OK"+(j.partidos_fallidos?.length?" · "+j.partidos_fallidos.length+" partidos fallidos":"")+(j.jugadoras_no_encontradas?" · "+j.jugadoras_no_encontradas+" jugs no encontradas en partido":"");
      setLigaProgress({done:1,total:1,paso:msg});
      alert(msg);
    }catch(e){alert("Error: "+e.message);}
    setCarrBusy("");
  }

  async function refrescarFechasLfb(){
    if(carrLiga!=="L007"){alert("Solo disponible para LFB (L007)");return;}
    if(!confirm("Refrescar fecha_hora de partidos "+carrLiga+" "+carrTemp+"? Scrapeará el calendario general (22 requests directos a basketlfb.com, ~30 s)."))return;
    setCarrBusy("fechas_lfb");
    setLigaProgress({done:0,total:22,paso:"Scrapeando calendario LBWL..."});
    try{
      const j=await callFn("refrescar-fechas-lfb",{temporada:carrTemp,id_liga:carrLiga,dry:false});
      if(j.ok===false){alert("Fallo: "+(j.motivo||j.error||"desconocido"));return;}
      const msg="✅ Fechas refrescadas · "+(j.total_actualizados||0)+" de "+(j.total_encontrados_web||0)+" encontrados (de "+(j.total_partidos_en_bd||0)+" en BD)"+(j.sin_partido_bd?.length?" · "+j.sin_partido_bd.length+" web sin match en BD":"");
      setLigaProgress({done:22,total:22,paso:msg});
      alert(msg);
    }catch(e){alert("Error: "+e.message);}
    setCarrBusy("");
  }

  async function ligaCargarCarreras(){
    if(!ligaInfo)return;
    var esEspn=["L020","L006"].includes(carrLiga);
    // Paso 1 (solo ligas ESPN): persistir los espn_match candidatos como id_espn
    // antes de lanzar el bucle. Así el edge cargar-carrera-espn-jugadora encuentra
    // el ID en la BD y no responde "sin id_espn".
    if(esEspn){
      var equiposConMatch=ligaInfo.filter(function(eq){
        return (eq.roster||[]).some(function(r){return r.espn_match&&!r.id_espn;});
      });
      if(equiposConMatch.length){
        setCarrBusy("liga_cargar");
        for(var mi=0;mi<equiposConMatch.length;mi++){
          var eqm=equiposConMatch[mi];
          setLigaProgress({done:mi,total:equiposConMatch.length,paso:"Persistiendo id_espn en "+eqm.equipo});
          try{await callFn("mapear-roster-espn",{id_equipo:eqm.id_equipo,id_liga:carrLiga,temporada:carrTemp,dry:false,crear_faltantes:true});}catch(e){/* seguimos, ya lo veremos por resultado */}
        }
        // Re-leemos id_espn de las jugadoras del roster para saber cuáles ya lo tienen persistido
        var idsRoster=[];
        ligaInfo.forEach(function(eq){(eq.roster||[]).forEach(function(r){if(idsRoster.indexOf(r.id_jugadora)<0)idsRoster.push(r.id_jugadora);});});
        if(idsRoster.length){
          var refetch=await supabase.from("jugadoras").select("id_jugadora,id_espn").in("id_jugadora",idsRoster);
          var espnMap={};(refetch.data||[]).forEach(function(x){espnMap[x.id_jugadora]=x.id_espn;});
          ligaInfo.forEach(function(eq){(eq.roster||[]).forEach(function(r){if(espnMap[r.id_jugadora])r.id_espn=espnMap[r.id_jugadora];});});
        }
      }
    }
    // Paso 2: junta todas las jugadoras únicas con id_espn ya persistido
    var vistos={};
    var todas=[];
    ligaInfo.forEach(eq=>{
      (eq.roster||[]).forEach(r=>{
        if(!r.id_espn)return;
        if(vistos[r.id_jugadora])return;
        vistos[r.id_jugadora]=true;
        todas.push({id_jugadora:r.id_jugadora,nombre:r.nombre});
      });
    });
    if(!todas.length){alert("Sin jugadoras con id_espn (re-analiza tras crear)");return;}
    if(!confirm("Cargar carreras completas de "+todas.length+" jugadoras? (puede tardar varios minutos)"))return;
    setCarrBusy("liga_cargar");
    var log=[];
    // Pre-check: partidos de la liga+temp seleccionada
    var partidosTemp=[];
    if(skipCargadas){
      var {data:ptmp}=await supabase.from("partidos").select("id").eq("id_liga",carrLiga).eq("temporada",carrTemp).limit(500);
      partidosTemp=(ptmp||[]).map(x=>x.id);
    }
    var UMBRAL=carrLiga==="L006"?40:20; // WNBA regular ~44, NCAA ~28
    for(var i=0;i<todas.length;i++){
      var p=todas[i];
      setLigaProgress({done:i,total:todas.length,paso:"Cargando "+p.nombre});
      // Pre-check skip
      if(skipCargadas&&partidosTemp.length){
        var {count}=await supabase.from("partido_boxscore").select("id",{count:"exact",head:true}).eq("id_jugadora",p.id_jugadora).in("id_partido",partidosTemp);
        if(count>=UMBRAL){
          log.push({jugadora:p.nombre,estado:"⏭ ya cargada ("+count+" box)"});
          setCarrLog([].concat(log));
          continue;
        }
      }
      log.push({jugadora:p.nombre,estado:"⏳"});
      setCarrLog([].concat(log));
      try{
        var j;
        var isFebL=["L001","L002","L003","L017","L074"].includes(carrLiga);
        var isFibaL=["L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga);
        if(["L007","L022","L098"].includes(carrLiga)){
          j=await callFn("cargar-carrera-lfb-jugadora",{id_jugadora:p.id_jugadora,id_liga:carrLiga,temporada:carrTemp,dry:false});
          var estadoLfb;
          if(j.ok===false){
            var motivosLfb={no_encontrada:"⏭ jugadora no existe",sin_id_lfb:"⏭ sin id_lfb",sin_temporadas:"⏭ sin temporadas",scrape_error:"⏭ scrape fallo ("+(j.status||"?")+")",sin_partidos_liga:"⏭ sin partidos de "+carrLiga+" en ficha"};
            estadoLfb=motivosLfb[j.motivo]||("⏭ "+(j.motivo||j.error||"skip"));
          } else if(j.error){
            estadoLfb="❌ "+j.error;
          } else {
            estadoLfb="✅ box:"+(j.boxscores||0)+" partidos+:"+(j.creados||0)+(j.sin_rival?.length?" ⚠️sin_rival:"+j.sin_rival.length:"");
          }
          log[log.length-1]={jugadora:p.nombre,estado:estadoLfb};
        } else if(isFebL){
          j=await callFn("cargar-carrera-feb-jugadora",{id_jugadora:p.id_jugadora,id_liga:carrLiga,temporada:carrTemp,dry:false});
          log[log.length-1]={jugadora:p.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.total_boxscores||0)+" pendientes:"+(j.pendientes||0)+"/"+(j.partidos_totales||0)};
        } else if(isFibaL){
          j=await callFn("cargar-carrera-fiba-jugadora",{id_jugadora:p.id_jugadora,id_liga:carrLiga,temporada:carrTemp,dry:false});
          log[log.length-1]={jugadora:p.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.boxscores||0)+" partidos+:"+(j.creados||0)+(j.sin_equipo?.length?" ⚠️sin_eq:"+j.sin_equipo.length:"")};
        } else {
          j=await callFn("cargar-carrera-espn-jugadora",{id_jugadora:p.id_jugadora,discover:true,dry:false,add_missing_teams:true});
          var estadoEspn;
          if(j.ok===false){
            var motivos={sin_id_espn:"⏭ sin ficha ESPN",no_encontrada:"⏭ jugadora no existe",db_error:"❌ BD: "+(j.detalle||"")};
            estadoEspn=motivos[j.motivo]||("⏭ "+(j.motivo||j.error||"skip"));
          } else if(j.error){
            estadoEspn="❌ "+j.error;
          } else {
            estadoEspn="✅ box:"+(j.total_boxscores||0)+" temps+:"+(j.total_temporadas_creadas||0)+" partidos+:"+(j.total_partidos_creados||0);
          }
          log[log.length-1]={jugadora:p.nombre,estado:estadoEspn};
        }
      }catch(e){log[log.length-1]={jugadora:p.nombre,estado:"❌ "+e.message};}
      setCarrLog([].concat(log));
    }
    setLigaProgress({done:todas.length,total:todas.length,paso:"Carga completa"});
    // Auto-saneo WNBA (playoffs + CC + consolidar CC Finals duplicados)
    if(carrLiga==="L006"){
      setLigaProgress({done:todas.length,total:todas.length,paso:"🧹 Saneando WNBA "+carrTemp+"..."});
      try{
        await callFn("sanear-wnba",{year:parseInt(carrTemp)});
        setLigaProgress({done:todas.length,total:todas.length,paso:"✅ Saneado completo"});
      }catch(e){setLigaProgress({done:todas.length,total:todas.length,paso:"⚠️ Saneo falló: "+e.message});}
    }
    setCarrBusy("");
  }

  async function carrCrearFaltantes(){
    var faltan=carrInfo?.solo_en_espn_obj?.length||(carrInfo?.solo_en_espn?.length||0);
    if(!faltan){alert("No hay jugadoras que crear");return;}
    if(!confirm("Crear "+faltan+" jugadoras y añadirles temporada "+carrTemp+" en "+carrInfo.equipo+"?"))return;
    setCarrBusy("crear");
    try{
      var j=await callFn("mapear-roster-espn",{id_equipo:carrEquipoId,id_liga:carrLiga,temporada:carrTemp,dry:false,crear_faltantes:true});
      setCarrInfo(j);
      alert("Creadas: "+(j.total_creadas||0)+" · Adjuntadas: "+(j.total_adjuntadas||0));
    }catch(e){alert("Error: "+e.message);}
    setCarrBusy("");
  }
  async function carrCargar(dry){
    if(!carrInfo?.roster)return;
    var conEspn=carrInfo.roster.filter(function(r){return r.id_espn||r.espn_match;});
    if(!conEspn.length){alert("Ninguna jugadora con id_espn");return;}
    setCarrBusy(dry?"dry":"cargar");setCarrLog([]);
    var log=[];
    for(var i=0;i<conEspn.length;i++){
      var r=conEspn[i];
      log.push({jugadora:r.nombre,estado:"⏳ procesando..."});
      setCarrLog([].concat(log));
      try{
        var j;
        var isFebL=["L001","L002","L003","L017","L074"].includes(carrLiga);
        var isFibaL=["L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga);
        if(["L007","L022","L098"].includes(carrLiga)){
          j=await callFn("cargar-carrera-lfb-jugadora",{id_jugadora:r.id_jugadora,temporada:carrTemp,dry:dry});
          log[i]={jugadora:r.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.boxscores||0)+" partidos+:"+(j.creados||0)+(j.sin_rival?.length?" ⚠️sin_rival:"+j.sin_rival.length:"")};
        } else if(isFebL){
          j=await callFn("cargar-carrera-feb-jugadora",{id_jugadora:r.id_jugadora,id_liga:carrLiga,temporada:carrTemp,dry:dry});
          log[i]={jugadora:r.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.total_boxscores||0)+" pendientes:"+(j.pendientes||0)+"/"+(j.partidos_totales||0)};
        } else if(isFibaL){
          j=await callFn("cargar-carrera-fiba-jugadora",{id_jugadora:r.id_jugadora,id_liga:carrLiga,temporada:carrTemp,dry:dry});
          log[i]={jugadora:r.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.boxscores||0)+" partidos+:"+(j.creados||0)+(j.sin_equipo?.length?" ⚠️sin_eq:"+j.sin_equipo.length:"")};
        } else {
          j=await callFn("cargar-carrera-espn-jugadora",{id_jugadora:r.id_jugadora,discover:true,dry:dry,add_missing_teams:true});
          log[i]={jugadora:r.nombre,estado:j.error?"❌ "+j.error:"✅ box:"+(j.total_boxscores||0)+" temps+:"+(j.total_temporadas_creadas||0)+" partidos+:"+(j.total_partidos_creados||0)};
        }
      }catch(e){log[i]={jugadora:r.nombre,estado:"❌ "+e.message};}
      setCarrLog([].concat(log));
    }
    setCarrBusy("");
  }

  // ── Fotos → FIBA (migración masiva de fotos rotas a FIBA por matching nombre+país+DOB) ──
  // La subscription key está expuesta públicamente en el bundle JS de fiba.basketball.
  // Si FIBA la rota, reemplazar esta constante mirando el bundle actual.
  const FIBA_APIM_KEY="898cd5e7389140028ecb42943c47eb74";
  const FIBA_SEARCH_URL="https://digital-api.fiba.basketball/hapi//getsearchresult";
  // Mapping ISO2 → ISO3 (FIBA devuelve códigos ISO3, la app usa ISO2 vía countryCode()).
  const ISO2_TO_ISO3={ad:"AND",ae:"UAE",af:"AFG",ag:"ATG",al:"ALB",am:"ARM",ao:"ANG",ar:"ARG",at:"AUT",au:"AUS",az:"AZE",ba:"BIH",bb:"BAR",bd:"BAN",be:"BEL",bf:"BUR",bg:"BUL",bh:"BRN",bi:"BDI",bj:"BEN",bn:"BRU",bo:"BOL",br:"BRA",bs:"BAH",bt:"BHU",bw:"BOT",by:"BLR",bz:"BIZ",ca:"CAN",cd:"COD",cf:"CAF",cg:"CGO",ch:"SUI",ci:"CIV",cl:"CHI",cm:"CMR",cn:"CHN",co:"COL",cr:"CRC",cu:"CUB",cv:"CPV",cy:"CYP",cz:"CZE",de:"GER",dj:"DJI",dk:"DEN",dm:"DMA",do:"DOM",dz:"ALG",ec:"ECU",ee:"EST",eg:"EGY",er:"ERI",es:"ESP",et:"ETH",fi:"FIN",fj:"FIJ",fr:"FRA",ga:"GAB",gb:"GBR",gd:"GRN",ge:"GEO",gh:"GHA",gm:"GAM",gn:"GUI",gq:"GEQ",gr:"GRE",gt:"GUA",gw:"GBS",gy:"GUY",hk:"HKG",hn:"HON",hr:"CRO",ht:"HAI",hu:"HUN",id:"INA",ie:"IRL",il:"ISR",in:"IND",iq:"IRQ",ir:"IRI",is:"ISL",it:"ITA",jm:"JAM",jo:"JOR",jp:"JPN",ke:"KEN",kg:"KGZ",kh:"CAM",ki:"KIR",kn:"SKN",kp:"PRK",kr:"KOR",kw:"KUW",kz:"KAZ",la:"LAO",lb:"LBN",lc:"LCA",li:"LIE",lk:"SRI",lr:"LBR",ls:"LES",lt:"LTU",lu:"LUX",lv:"LAT",ly:"LBA",ma:"MAR",mc:"MON",md:"MDA",me:"MNE",mg:"MAD",mh:"MHL",mk:"MKD",ml:"MLI",mm:"MYA",mn:"MGL",mr:"MTN",mt:"MLT",mu:"MRI",mv:"MDV",mw:"MAW",mx:"MEX",my:"MAS",mz:"MOZ",na:"NAM",ne:"NIG",ng:"NGR",ni:"NCA",nl:"NED",no:"NOR",np:"NEP",nr:"NRU",nz:"NZL",om:"OMA",pa:"PAN",pe:"PER",pg:"PNG",ph:"PHI",pk:"PAK",pl:"POL",pt:"POR",pw:"PLW",py:"PAR",qa:"QAT",ro:"ROU",rs:"SRB",ru:"RUS",rw:"RWA",sa:"KSA",sb:"SOL",sc:"SEY",sd:"SUD",se:"SWE",sg:"SGP",si:"SLO",sk:"SVK",sl:"SLE",sm:"SMR",sn:"SEN",so:"SOM",sr:"SUR",ss:"SSD",st:"STP",sv:"ESA",sy:"SYR",sz:"SWZ",td:"CHA",tg:"TOG",th:"THA",tj:"TJK",tl:"TLS",tm:"TKM",tn:"TUN",to:"TGA",tr:"TUR",tt:"TTO",tv:"TUV",tw:"TPE",tz:"TAN",ua:"UKR",ug:"UGA",us:"USA",uy:"URU",uz:"UZB",vc:"VIN",ve:"VEN",vn:"VIE",vu:"VAN",ws:"SAM",ye:"YEM",za:"RSA",zm:"ZAM",zw:"ZIM"};
  var [fibaBusy,setFibaBusy]=useState(false);
  var [fibaProgress,setFibaProgress]=useState({done:0,total:0});
  var [fibaResults,setFibaResults]=useState(null);
  var [fibaSubTab,setFibaSubTab]=useState("altos");
  var [fibaLastBatchId,setFibaLastBatchId]=useState(null);
  var [fibaApplying,setFibaApplying]=useState(false);
  var [fibaApplyRes,setFibaApplyRes]=useState(null);
  var [fibaConfirmKey,setFibaConfirmKey]=useState(null);
  // ── Rellenar desde FIBA (autocompleta altura/fecha_nac desde ficha oficial usando fiba_person_id) ──
  var [llenoBusy,setLlenoBusy]=useState(false);
  var [llenoProgress,setLlenoProgress]=useState({done:0,total:0});
  var [llenoResults,setLlenoResults]=useState(null);
  var [llenoApplying,setLlenoApplying]=useState(false);
  var [llenoApplyRes,setLlenoApplyRes]=useState(null);
  var [llenoConfirmKey,setLlenoConfirmKey]=useState(null);
  var [llenoLastBatchId,setLlenoLastBatchId]=useState(null);

  async function runLlenoScan(){
    setLlenoBusy(true);setLlenoResults(null);setLlenoApplyRes(null);
    try{
      const {data:jugs,error}=await supabase.from("jugadoras")
        .select("id_jugadora,nombre,nacionalidad,fecha_nac,altura_cm,fiba_person_id")
        .not("fiba_person_id","is",null);
      if(error)throw error;
      setLlenoProgress({done:0,total:jugs.length});
      const conDiff=[],sinDiff=[],errores=[];
      for(let i=0;i<jugs.length;i++){
        const p=jugs[i];
        try{
          // Búsqueda hapi de FIBA (CORS ok, sin proxy, sin rate-limit). Da birthdate + country
          // pero no altura. Filtramos por id exacto para elegir la candidata correcta.
          const cands=await fibaSearchOne(p);
          const fiba=cands.find(c=>String(c.id)===String(p.fiba_person_id));
          if(!fiba)throw new Error("id "+p.fiba_person_id+" no en resultados FIBA");
          const fibaDob=fiba.birthdate?new Date(fiba.birthdate).toISOString().slice(0,10):null;
          const diffs={};
          if(fibaDob&&fibaDob!==p.fecha_nac){
            diffs.fecha_nac={de:p.fecha_nac,a:fibaDob};
          }
          const bdIso2=countryCode(p.nacionalidad);
          const bdIso3=bdIso2?ISO2_TO_ISO3[bdIso2]:null;
          if(fiba.country&&bdIso3&&bdIso3!==fiba.country){
            diffs.nacionalidad={de:p.nacionalidad,a:fiba.country,soloAviso:true};
          }
          const entry={p,fiba:{birthdate:fibaDob,nationality:fiba.country},diffs};
          if(Object.keys(diffs).filter(k=>!diffs[k].soloAviso).length>0)conDiff.push(entry);
          else sinDiff.push(entry);
        }catch(e){errores.push({p,err:String(e.message||e)});}
        setLlenoProgress({done:i+1,total:jugs.length});
        await new Promise(r=>setTimeout(r,250));
      }
      setLlenoResults({conDiff,sinDiff,errores});
    }catch(e){setLlenoResults({error:e.message});}
    setLlenoBusy(false);
  }

  async function applyLlenoBatch(entries){
    if(!entries?.length){setLlenoApplyRes({error:"No hay entradas."});return;}
    setLlenoApplying(true);setLlenoApplyRes(null);setLlenoConfirmKey(null);
    try{
      const batchId=(window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():("b-"+Date.now()+"-"+Math.random().toString(36).slice(2));
      const backups=[];
      const updates=[];
      for(const e of entries){
        const upd={};
        for(const campo of Object.keys(e.diffs)){
          if(e.diffs[campo].soloAviso)continue;
          upd[campo]=e.diffs[campo].a;
          backups.push({
            id_jugadora:e.p.id_jugadora,
            campo:campo,
            valor_anterior:e.diffs[campo].de==null?null:String(e.diffs[campo].de),
            valor_nuevo:String(e.diffs[campo].a),
            batch_id:batchId
          });
        }
        if(Object.keys(upd).length>0)updates.push({id_jugadora:e.p.id_jugadora,upd});
      }
      if(backups.length>0){
        const {error:bkErr}=await supabase.from("datos_backup").insert(backups);
        if(bkErr)throw bkErr;
      }
      let ok=0,err=0;
      for(const u of updates){
        const {error}=await supabase.from("jugadoras").update(u.upd).eq("id_jugadora",u.id_jugadora);
        if(error)err++;else ok++;
      }
      setLlenoLastBatchId(batchId);
      setLlenoApplyRes({ok,err,batchId,total:updates.length,campos:backups.length});
      const applied=new Set(entries.map(e=>e.p.id_jugadora));
      setLlenoResults(prev=>prev?({...prev,conDiff:prev.conDiff.filter(e=>!applied.has(e.p.id_jugadora))}):prev);
      onReload();
    }catch(e){setLlenoApplyRes({error:e.message});}
    setLlenoApplying(false);
  }

  async function revertLlenoBatch(batchId){
    if(!batchId)return;
    try{
      const {data:rows,error}=await supabase.from("datos_backup")
        .select("*").eq("batch_id",batchId).eq("revertido",false);
      if(error)throw error;
      const porJug={};
      for(const r of rows||[]){
        if(!porJug[r.id_jugadora])porJug[r.id_jugadora]={};
        let v=r.valor_anterior;
        if(r.campo==="altura_cm"&&v!=null)v=parseInt(v,10);
        porJug[r.id_jugadora][r.campo]=v;
      }
      let ok=0;
      for(const id_jugadora of Object.keys(porJug)){
        const {error:uErr}=await supabase.from("jugadoras").update(porJug[id_jugadora]).eq("id_jugadora",id_jugadora);
        if(!uErr)ok++;
      }
      await supabase.from("datos_backup").update({revertido:true,revertido_at:new Date().toISOString()}).eq("batch_id",batchId);
      alert(`Revertidas ${ok} de ${Object.keys(porJug).length} jugadoras.`);
      setLlenoLastBatchId(null);
      onReload();
    }catch(e){alert("Error revirtiendo: "+e.message);}
  }

  function fibaNorm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim();}
  function fibaScoreCandidate(pl,cand){
    const bdName=fibaNorm(pl.nombre);
    const bdTokens=bdName.split(" ").filter(t=>t.length>=2);
    const fibaName=fibaNorm((cand.display_firstname||cand.firstname||"")+" "+(cand.display_lastname||cand.lastname||""));
    const fibaLast=fibaNorm(cand.display_lastname||cand.lastname||"");
    let nameOk=false;
    if(fibaLast){
      const lastTokens=fibaLast.split(" ").filter(t=>t.length>=2);
      const allLastInBD=lastTokens.length>0&&lastTokens.every(t=>bdTokens.includes(t));
      const anyBDInFiba=bdTokens.some(t=>fibaName.split(" ").includes(t));
      nameOk=allLastInBD&&anyBDInFiba;
    }
    const bdIso2=countryCode(pl.nacionalidad);
    const bdIso3=bdIso2?ISO2_TO_ISO3[bdIso2]:null;
    const countryPresent=!!(bdIso3&&cand.country);
    const countryOk=countryPresent&&bdIso3.toUpperCase()===String(cand.country).toUpperCase();
    let dobOk=false,dobPresent=false;
    if(pl.fecha_nac&&cand.birthdate){
      dobPresent=true;
      const a=new Date(pl.fecha_nac).getTime();
      const b=new Date(cand.birthdate).getTime();
      if(!isNaN(a)&&!isNaN(b))dobOk=Math.abs(a-b)<=3*24*60*60*1000;
    }
    const totalPossible=1+(countryPresent?1:0)+(dobPresent?1:0);
    const scored=(nameOk?1:0)+(countryOk?1:0)+(dobOk?1:0);
    return {nameOk,countryOk,dobOk,countryPresent,dobPresent,totalPossible,scored};
  }

  async function fibaSearchOne(pl){
    const partes=fibaNorm(pl.nombre).split(" ").filter(t=>t.length>=2);
    if(partes.length<1)return [];
    const nom=partes[0];
    // Múltiples estrategias de apellido para nombres con 3+ tokens (típico español: doble apellido).
    // FIBA a veces indexa por el primer apellido, otras por el último — probamos ambos y unimos.
    const apellidos=[];
    if(partes.length<=2){
      apellidos.push(partes[partes.length-1]);
    }else{
      apellidos.push(partes[1]);
      apellidos.push(partes[partes.length-1]);
      if(partes.length>=4&&apellidos.indexOf(partes[partes.length-2])<0)apellidos.push(partes[partes.length-2]);
    }
    const seen=new Set();
    const all=[];
    for(const ape of apellidos){
      if(ape===nom)continue;
      const s=`(${nom} + ${ape}) | (${nom} | ${ape}) | (${nom}* | ${ape}*)`;
      const url=FIBA_SEARCH_URL+"?s="+encodeURIComponent(s)+"&l=en&c=hub&teamsfilter="+encodeURIComponent("organisationstatuscode eq 'ACT'");
      try{
        const r=await fetch(url,{headers:{"Content-Type":"application/json","Ocp-Apim-Subscription-Key":FIBA_APIM_KEY}});
        if(!r.ok)continue;
        const arr=await r.json();
        const cands=arr.filter(x=>x.type==="players").map(x=>{try{return JSON.parse(x.data);}catch(_){return null;}}).filter(Boolean);
        for(const c of cands){if(!seen.has(String(c.id))){seen.add(String(c.id));all.push(c);}}
        if(apellidos.length>1)await new Promise(r=>setTimeout(r,150));
      }catch(_){}
    }
    return all.slice(0,15);
  }

  async function runFibaScan(){
    setFibaBusy(true);setFibaResults(null);setFibaApplyRes(null);
    try{
      const {data:jugs,error}=await supabase.from("jugadoras")
        .select("id_jugadora,nombre,nacionalidad,fecha_nac,foto")
        .ilike("foto","%proballers.com%")
        .not("fecha_nac","is",null)
        .not("nacionalidad","is",null)
        .is("fiba_person_id",null);
      if(error)throw error;
      setFibaProgress({done:0,total:jugs.length});
      const altos=[],medios=[],bajos=[],errores=[];
      for(let i=0;i<jugs.length;i++){
        const p=jugs[i];
        try{
          const cands=await fibaSearchOne(p);
          let bestCand=null,bestScore={scored:-1,nameOk:false,countryOk:false,dobOk:false,totalPossible:0};
          for(const c of cands){
            const sc=fibaScoreCandidate(p,c);
            if(sc.scored>bestScore.scored){bestCand=c;bestScore=sc;}
          }
          const entry={p,cand:bestCand,score:bestScore,cands};
          if(bestCand&&bestScore.nameOk&&bestScore.totalPossible>=2&&bestScore.scored===bestScore.totalPossible){
            altos.push(entry);
          }else if(bestCand&&bestScore.scored>=1){
            medios.push(entry);
          }else{
            bajos.push(entry);
          }
        }catch(e){errores.push({p,err:String(e.message||e)});}
        setFibaProgress({done:i+1,total:jugs.length});
        await new Promise(r=>setTimeout(r,250));
      }
      setFibaResults({altos,medios,bajos,errores});
      setFibaSubTab("altos");
    }catch(e){setFibaResults({error:e.message});}
    setFibaBusy(false);
  }

  async function applyFibaBatch(entries){
    if(!entries?.length){setFibaApplyRes({error:"No hay entradas para aplicar."});return;}
    setFibaApplying(true);setFibaApplyRes(null);setFibaConfirmKey(null);
    try{
      const batchId=(window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():("b-"+Date.now()+"-"+Math.random().toString(36).slice(2));
      const backups=entries.map(({p,cand,score})=>({
        id_jugadora:p.id_jugadora,
        foto_anterior:p.foto,
        foto_nueva:`https://assets.fiba.basketball/image/upload/w_400,c_fill,g_face/q_auto/f_auto/.headshot--person_${cand.id}`,
        fiba_person_id_nuevo:parseInt(cand.id),
        score:score.scored,
        batch_id:batchId
      }));
      const {error:bkErr}=await supabase.from("fotos_backup").insert(backups);
      if(bkErr)throw bkErr;
      let ok=0,err=0;
      for(const b of backups){
        const {error}=await supabase.from("jugadoras")
          .update({foto:b.foto_nueva,fiba_person_id:b.fiba_person_id_nuevo})
          .eq("id_jugadora",b.id_jugadora);
        if(error)err++;else ok++;
      }
      setFibaLastBatchId(batchId);
      setFibaApplyRes({ok,err,batchId,total:backups.length});
      const applied=new Set(entries.map(e=>e.p.id_jugadora));
      setFibaResults(prev=>prev?({
        ...prev,
        altos:prev.altos.filter(e=>!applied.has(e.p.id_jugadora)),
        medios:prev.medios.filter(e=>!applied.has(e.p.id_jugadora)),
        bajos:prev.bajos.filter(e=>!applied.has(e.p.id_jugadora))
      }):prev);
      onReload();
    }catch(e){setFibaApplyRes({error:e.message});}
    setFibaApplying(false);
  }

  async function applyPlaceholderToEntries(entries){
    if(!entries?.length){setFibaApplyRes({error:"No hay entradas."});return;}
    setFibaApplying(true);setFibaApplyRes(null);setFibaConfirmKey(null);
    try{
      const PLACEHOLDER="https://static.flashscore.com/res/image/empty-face-woman-share.gif";
      const batchId=(window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():("b-"+Date.now()+"-"+Math.random().toString(36).slice(2));
      const backups=entries.map(({p})=>({
        id_jugadora:p.id_jugadora,
        foto_anterior:p.foto,
        foto_nueva:PLACEHOLDER,
        fiba_person_id_nuevo:null,
        score:0,
        batch_id:batchId
      }));
      const {error:bkErr}=await supabase.from("fotos_backup").insert(backups);
      if(bkErr)throw bkErr;
      let ok=0,err=0;
      for(const b of backups){
        const {error}=await supabase.from("jugadoras")
          .update({foto:b.foto_nueva})
          .eq("id_jugadora",b.id_jugadora);
        if(error)err++;else ok++;
      }
      setFibaLastBatchId(batchId);
      setFibaApplyRes({ok,err,batchId,total:backups.length,placeholder:true});
      const applied=new Set(entries.map(e=>e.p.id_jugadora));
      setFibaResults(prev=>prev?({
        ...prev,
        altos:prev.altos.filter(e=>!applied.has(e.p.id_jugadora)),
        medios:prev.medios.filter(e=>!applied.has(e.p.id_jugadora)),
        bajos:prev.bajos.filter(e=>!applied.has(e.p.id_jugadora))
      }):prev);
      onReload();
    }catch(e){setFibaApplyRes({error:e.message});}
    setFibaApplying(false);
  }

  async function revertFibaBatch(batchId){
    if(!batchId)return;
    try{
      const {data:rows,error}=await supabase.from("fotos_backup")
        .select("*").eq("batch_id",batchId).eq("revertido",false);
      if(error)throw error;
      let ok=0;
      for(const r of rows||[]){
        const {error:uErr}=await supabase.from("jugadoras")
          .update({foto:r.foto_anterior,fiba_person_id:null})
          .eq("id_jugadora",r.id_jugadora);
        if(!uErr)ok++;
      }
      await supabase.from("fotos_backup").update({revertido:true,revertido_at:new Date().toISOString()}).eq("batch_id",batchId);
      alert(`Revertidas ${ok} de ${(rows||[]).length} jugadoras.`);
      setFibaLastBatchId(null);
      onReload();
    }catch(e){alert("Error revirtiendo: "+e.message);}
  }

  // Alta por lotes
  var [lotEquipo,setLotEquipo]=useState("");
  var [lotLiga,setLotLiga]=useState("");
  var [lotTemp,setLotTemp]=useState("");
  var [lotTexto,setLotTexto]=useState("");
  var [lotBusy,setLotBusy]=useState(false);
  var [lotRes,setLotRes]=useState(null);

  async function runLotes(){
    if(!lotEquipo||!lotLiga||!lotTemp||!lotTexto.trim()){alert("Rellena equipo, liga, temporada y la lista de jugadoras.");return;}
    setLotBusy(true);setLotRes(null);
    try{
      const nombres=lotTexto.split("\n").map(n=>n.trim()).filter(Boolean);
      const encontradas=[];const noEncontradas=[];const yaEstaban=[];const anadidas=[];
      // Buscar el max id de temporadas
      const {data:maxRow}=await supabase.from("temporadas").select("id").order("id",{ascending:false}).limit(1);
      let nextId=(Number(maxRow?.[0]?.id)||0)+1;
      for(const nombre of nombres){
        // Buscar por apellido (última palabra)
        const partes=nombre.split(/\s+/);
        const apellido=partes[partes.length-1];
        const {data:cands}=await supabase.from("jugadoras").select("id_jugadora,nombre").ilike("nombre",`%${apellido}%`).limit(50);
        // Score matching
        let best=null,bestScore=0;
        const normNom=nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
        for(const c of (cands||[])){
          const cn=c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
          const score=normNom.split(/\s+/).filter(w=>w.length>2&&cn.includes(w)).length;
          if(score>bestScore){bestScore=score;best=c;}
        }
        if(!best||bestScore<2){noEncontradas.push(nombre);continue;}
        encontradas.push({nombre,id:best.id_jugadora,nombreBD:best.nombre});
        // Comprobar si ya está en ese equipo/liga/temporada
        const {data:ex}=await supabase.from("temporadas").select("id").eq("id_jugadora",best.id_jugadora).eq("id_equipo",lotEquipo).eq("id_liga",lotLiga).eq("temporada",lotTemp).maybeSingle();
        if(ex){yaEstaban.push(nombre);continue;}
        // Insertar
        const {error}=await supabase.from("temporadas").insert({id:nextId++,id_jugadora:best.id_jugadora,id_equipo:lotEquipo,id_liga:lotLiga,temporada:lotTemp,orden:0});
        if(!error)anadidas.push(`${best.nombre} (${best.id_jugadora})`);
        else noEncontradas.push(`${nombre} — error: ${error.message}`);
      }
      // Ajustar secuencia
      // Intentar setval directamente
      setLotRes({total:nombres.length,encontradas:encontradas.length,anadidas,yaEstaban,noEncontradas});
      if(anadidas.length)onReload();
    }catch(e){setLotRes({error:e.message});}
    setLotBusy(false);
  }
  var scTempState=useState("");var scTemp=scTempState[0];var setScTemp=scTempState[1];
  var scSlugState=useState("");var scSlug=scSlugState[0];var setScSlug=scSlugState[1];
  var scDryState=useState(true);var scDry=scDryState[0];var setScDry=scDryState[1];
  var scCrearState=useState(false);var scCrear=scCrearState[0];var setScCrear=scCrearState[1];
  var scForceState=useState(false);var scForce=scForceState[0];var setScForce=scForceState[1];
  var scBusyState=useState(false);var scBusy=scBusyState[0];var setScBusy=scBusyState[1];
  var scResState=useState(null);var scRes=scResState[0];var setScRes=scResState[1];
  // Construye el slug FIBA desde la plantilla de la liga (columna slug_fiba) y la temporada.
  // Tokens: {t}=temporada tal cual · {ss}=temporada corta (2025-26→25-26) · {yyyy}=año · {yy}=año 2 díg.
  function buildSlug(tpl,t){
    t=(t||"").trim(); if(!tpl)return "";
    var m=t.match(/^(\d{4})-(\d{2})$/);
    var yyyy=m?m[1]:(/^\d{4}$/.test(t)?t:t);
    var ss=m?(m[1].slice(2)+"-"+m[2]):(/^\d{4}$/.test(t)?t.slice(2):t);
    var yy=m?m[1].slice(2):(/^\d{4}$/.test(t)?t.slice(2):t);
    return tpl.replace(/\{t\}/g,t).replace(/\{ss\}/g,ss).replace(/\{yyyy\}/g,yyyy).replace(/\{yy\}/g,yy);
  }
  function ligaTpl(id){var l=(ligas||[]).find(function(x){return x.id_liga===id;});return l?l.slug_fiba:null;}
  function onScLiga(id){setScLiga(id);var tpl=ligaTpl(id);setScSlug(tpl?buildSlug(tpl,scTemp):"");}
  function onScTemp(t){setScTemp(t);var tpl=ligaTpl(scLiga);if(tpl)setScSlug(buildSlug(tpl,t));}
  async function runScraper(){
    if(!scLiga||!scSlug.trim()){setScRes({error:"Liga y slug son obligatorios"});return;}
    setScBusy(true);setScRes(null);
    // Se procesa por lotes: la Edge Function tiene limite de tiempo, asi que pedimos
    // ventanas de partidos y vamos acumulando hasta que no quede siguiente_offset.
    var acc={partidos:0,total:0,creados:0,notas_rellenadas:0,parciales_escritos:0,hechos:0,saltados:0,filas:0,via_global:0,plantilla_altas:0,sin_mapear:[],sin_mapear_equipos:[],colisiones:[],creados_detalle:[],dry:scDry};
    try{
      // History (render=true en ScraperAPI) tarda ~25s por partido → bajar tamaño de lote para no exceder el timeout de la edge (150s).
      var esHistory=scSlug.trim().indexOf("history/")===0;
      var loteLimit=esHistory?4:15;
      var offset=0,primera=true,guard=0;
      while(guard<80){
        guard++;
        var inv=await supabase.functions.invoke("cargar-boxscores-fiba",{body:{id_liga:scLiga,temporada:scTemp.trim(),slug:scSlug.trim(),dry:scDry,crear:scCrear&&primera,force:scForce,offset:offset,limit:loteLimit}});
        if(inv.error){setScRes(Object.assign({},acc,{error:String((inv.error&&inv.error.message)||inv.error)}));setScBusy(false);return;}
        var d=inv.data||{};
        if(d.error){setScRes(Object.assign({},acc,{error:d.error}));setScBusy(false);return;}
        acc.partidos=d.partidos||acc.partidos;acc.total=d.total||acc.total;
        acc.creados+=d.creados||0;acc.notas_rellenadas+=d.notas_rellenadas||0;
        acc.parciales_escritos+=d.parciales_escritos||0;
        acc.hechos+=d.hechos||0;acc.saltados+=d.saltados||0;acc.filas+=d.filas||0;
        acc.via_global+=d.via_global||0;acc.plantilla_altas+=d.plantilla_altas||0;
        acc.sin_mapear=Array.from(new Set(acc.sin_mapear.concat(d.sin_mapear||[])));
        acc.sin_mapear_equipos=Array.from(new Set(acc.sin_mapear_equipos.concat(d.sin_mapear_equipos||[])));
        acc.colisiones=Array.from(new Set(acc.colisiones.concat(d.colisiones||[])));
        acc.creados_detalle=acc.creados_detalle.concat(d.creados_detalle||[]);
        acc.mensaje=d.mensaje;
        var hechoHasta=(d.siguiente_offset!=null?d.siguiente_offset:(d.total||0));
        setScRes(Object.assign({},acc,{progreso:hechoHasta+"/"+(d.total||0)}));
        primera=false;
        if(scDry||d.siguiente_offset==null)break;
        offset=d.siguiente_offset;
      }
    }catch(e){setScRes(Object.assign({},acc,{error:String(e)}));}
    setScBusy(false);
  }
  // ── Enriquecer fichas jugadoras vía FEB (fecha_nac, altura, posicion, nacionalidad) ──
  var febBusyState=useState(false);var febBusy=febBusyState[0];var setFebBusy=febBusyState[1];
  var febResState=useState(null);var febRes=febResState[0];var setFebRes=febResState[1];
  var febLimitState=useState(3);var febLimit=febLimitState[0];var setFebLimit=febLimitState[1];
  var febDryState=useState(false);var febDry=febDryState[0];var setFebDry=febDryState[1];
  var febLoopState=useState(false);var febLoop=febLoopState[0];var setFebLoop=febLoopState[1];
  var febPendState=useState(null);var febPend=febPendState[0];var setFebPend=febPendState[1];
  useEffect(function(){
    (async function(){
      try{
        // RPC gemela de jugadoras_feb_sin_fecha_random: excluye cuarentena y jugadoras sin partido FEB scrapeado. El count directo sobre jugadoras sobre-contaba.
        var q=await supabase.rpc("jugadoras_feb_pendientes_count");
        setFebPend(q.data||0);
      }catch(e){}
    })();
  },[febRes]);
  async function runFebEnriq(){
    setFebBusy(true);setFebRes(null);
    var acc={candidatas:0,fichas_actualizadas:0,partidos_scrapeados:0,resultados:[],errores:[]};
    try{
      var iter=0;
      while(iter<20){
        iter++;
        var inv=await supabase.functions.invoke("enriquecer-jugadoras-feb",{body:{limit:febLimit,dry:febDry}});
        if(inv.error){setFebRes(Object.assign({},acc,{error:String((inv.error&&inv.error.message)||inv.error)}));setFebBusy(false);return;}
        var d=inv.data||{};
        if(d.error){setFebRes(Object.assign({},acc,{error:d.error}));setFebBusy(false);return;}
        acc.candidatas+=d.candidatas||0;
        acc.fichas_actualizadas+=d.fichas_actualizadas||0;
        acc.partidos_scrapeados+=d.partidos_scrapeados||0;
        acc.resultados=acc.resultados.concat(d.resultados||[]);
        acc.errores=acc.errores.concat(d.errores||[]);
        setFebRes(Object.assign({},acc,{iter}));
        if(!febLoop||febDry||(d.candidatas||0)===0)break;
      }
    }catch(e){setFebRes(Object.assign({},acc,{error:String(e)}));}
    setFebBusy(false);
  }

  var fixState=useState(null);
  var fixing=fixState[0];var setFixing=fixState[1];
  var ignoredState=useState(new Set());
  var ignored=ignoredState[0];var setIgnored=ignoredState[1];
  var loadingDupState=useState(true);
  var loadingDup=loadingDupState[0];var setLoadingDup=loadingDupState[1];

  useEffect(function(){
    (async function(){
      try{
        var r=await supabase.from("duplicados_ignorados").select("tipo,ids");
        var s=new Set((r.data||[]).map(function(row){return row.tipo+"|"+row.ids;}));
        setIgnored(s);
      }catch(e){console.error("Error cargando ignorados:",e);}
      setLoadingDup(false);
    })();
  },[]);

  var norm=function(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();};
  var groupKey=function(tipo,items,idKey){var ids=items.map(function(it){return it[idKey];}).sort().join(",");return tipo+"|"+ids;};

  // Distancia de Levenshtein simple, usada para tolerar errores de tipeo en nombres
  var levenshtein=function(a,b){
    if(a===b)return 0;
    var m=a.length,n=b.length;
    if(!m)return n; if(!n)return m;
    var prev=new Array(n+1);for(var j=0;j<=n;j++)prev[j]=j;
    for(var i=1;i<=m;i++){
      var cur=[i];
      for(var jj=1;jj<=n;jj++){
        var cost=a[i-1]===b[jj-1]?0:1;
        cur[jj]=Math.min(prev[jj]+1,cur[jj-1]+1,prev[jj-1]+cost);
      }
      prev=cur;
    }
    return prev[n];
  };
  // ¿Son nombres parecidos? Se considera coincidencia si:
  // - los tokens (palabras) de uno son subconjunto de los del otro (nombres truncados/abreviados), o
  // - la distancia de Levenshtein relativa es baja (errores de tipeo / variantes ortográficas)
  var similarNames=function(a,b){
    var na=norm(a),nb=norm(b);
    if(!na||!nb)return false;
    if(na===nb)return true;
    var ta=na.split(" ").filter(Boolean),tb=nb.split(" ").filter(Boolean);
    var sa=new Set(ta),sb=new Set(tb);
    var shorter=ta.length<=tb.length?sa:sb,longer=ta.length<=tb.length?sb:sa;
    var shorterArr=shorter===sa?ta:tb;
    if(shorterArr.length>=2){
      var allIn=true;
      shorterArr.forEach(function(tok){if(!longer.has(tok))allIn=false;});
      if(allIn)return true;
    }
    var maxLen=Math.max(na.length,nb.length);
    if(maxLen<=4)return false;
    var dist=levenshtein(na,nb);
    return dist/maxLen<=0.2;
  };
  // Atributos secundarios que refuerzan la sospecha de duplicado (evita falsos positivos de nombres comunes)
  var sharedAttr=function(a,b,tipo){
    if(tipo==="jugadoras"||tipo==="coaches"){
      if(a.fecha_nac&&b.fecha_nac&&a.fecha_nac===b.fecha_nac)return true;
      if(tipo==="jugadoras"&&a.altura_cm&&b.altura_cm&&a.altura_cm===b.altura_cm&&a.posicion&&b.posicion&&a.posicion===b.posicion)return true;
      if(a.nacionalidad&&b.nacionalidad&&a.nacionalidad===b.nacionalidad&&a.fecha_nac&&b.fecha_nac)return true;
    }
    if(tipo==="equipos"){
      if(a.pais&&b.pais&&a.pais===b.pais&&a.ciudad&&b.ciudad&&a.ciudad===b.ciudad)return true;
    }
    if(tipo==="ligas"){
      if(a.pais&&b.pais&&a.pais===b.pais)return true;
    }
    return false;
  };
  var findDupes=function(items,nameKey,idKey,tipo){
    var n=items.length;
    if(n>3000){
      // Para tablas muy grandes (jugadoras), evitamos O(n²): agrupamos por prefijo del nombre
      // normalizado y solo comparamos dentro del mismo bloque + bloques vecinos alfabéticamente.
      var normed=items.map(function(it){return norm(it[nameKey]);});
      var buckets={};
      for(var i=0;i<n;i++){
        var key3=normed[i].slice(0,3);
        if(!key3)continue;
        if(!buckets[key3])buckets[key3]=[];
        buckets[key3].push(i);
      }
      var used=new Array(n).fill(false);
      var groupsArr=[];
      var bucketKeys=Object.keys(buckets);
      for(var bi=0;bi<bucketKeys.length;bi++){
        var idxs=buckets[bucketKeys[bi]];
        for(var ii=0;ii<idxs.length;ii++){
          var gi=idxs[ii];
          if(used[gi])continue;
          var cluster=[items[gi]];
          for(var jj=ii+1;jj<idxs.length;jj++){
            var gj=idxs[jj];
            if(used[gj])continue;
            var nameMatch=similarNames(items[gi][nameKey],items[gj][nameKey]);
            if(!nameMatch)continue;
            var exact=normed[gi]===normed[gj];
            if(exact||sharedAttr(items[gi],items[gj],tipo)){
              cluster.push(items[gj]);
              used[gj]=true;
            }
          }
          if(cluster.length>1){used[gi]=true;groupsArr.push(cluster);}
        }
      }
      return groupsArr.map(function(grp){return{key:norm(grp[0][nameKey]),items:grp,gk:groupKey(tipo,grp,idKey)};}).filter(function(g){return !ignored.has(g.gk);});
    }
    var used=new Array(n).fill(false);
    var groupsArr=[];
    for(var i=0;i<n;i++){
      if(used[i])continue;
      var cluster=[items[i]];
      for(var j=i+1;j<n;j++){
        if(used[j])continue;
        var nameMatch=similarNames(items[i][nameKey],items[j][nameKey]);
        if(!nameMatch)continue;
        // Si el nombre normalizado es idéntico, basta; si no, exigir un atributo compartido para evitar falsos positivos
        var exact=norm(items[i][nameKey])===norm(items[j][nameKey]);
        if(exact||sharedAttr(items[i],items[j],tipo)){
          cluster.push(items[j]);
          used[j]=true;
        }
      }
      if(cluster.length>1){used[i]=true;groupsArr.push(cluster);}
    }
    return groupsArr.map(function(items){return{key:norm(items[0][nameKey]),items:items,gk:groupKey(tipo,items,idKey)};}).filter(function(g){return !ignored.has(g.gk);});
  };
  var dupCheckState=useState({checked:false,checking:false});
  var dupCheckInfo=dupCheckState[0];var setDupCheckInfo=dupCheckState[1];
  var nameDupesState=useState({jugadoras:[],equipos:[],ligas:[],coaches:[]});
  var [mergeTarget,setMergeTarget]=useState(null); // {tipo, items: [{id, nombre, ...}], keepIdx: 0}
  var [merging,setMerging]=useState(false);

  async function doMerge(){
    if(!mergeTarget||mergeTarget.keepIdx==null){
      alert("Selecciona primero qué registro conservar");
      return;
    }
    setMerging(true);
    try{
      const keep=mergeTarget.items[mergeTarget.keepIdx];
      const remove=mergeTarget.items.filter((_,i)=>i!==mergeTarget.keepIdx);
      const idKey={jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"}[mergeTarget.tipo];
      const keepId=keep[idKey];
      for(const rem of remove){
        const remId=rem[idKey];
        if(mergeTarget.tipo==="jugadoras"){
          // Mover temporadas
          const {data:existTemp}=await supabase.from("temporadas").select("id_equipo,id_liga,temporada").eq("id_jugadora",keepId);
          const existSet=new Set((existTemp||[]).map(t=>t.id_equipo+"|"+t.id_liga+"|"+t.temporada));
          const {data:remTemp}=await supabase.from("temporadas").select("id,id_equipo,id_liga,temporada").eq("id_jugadora",remId);
          for(const t of (remTemp||[])){
            if(existSet.has(t.id_equipo+"|"+t.id_liga+"|"+t.temporada)){
              await supabase.from("temporadas").delete().eq("id",t.id);
            }else{
              await supabase.from("temporadas").update({id_jugadora:keepId}).eq("id",t.id);
            }
          }
          // Mover boxscores
          await supabase.from("partido_boxscore").update({id_jugadora:keepId}).eq("id_jugadora",remId);
          // Copiar datos que falten
          const {data:keepData}=await supabase.from("jugadoras").select("*").eq("id_jugadora",keepId).single();
          const {data:remData}=await supabase.from("jugadoras").select("*").eq("id_jugadora",remId).single();
          if(keepData&&remData){
            const upd={};
            ["posicion","nacionalidad","fecha_nac","altura_cm","nacionalidad2","id_ext","id_espn","foto"].forEach(f=>{
              if(!keepData[f]&&remData[f])upd[f]=remData[f];
            });
            if(Object.keys(upd).length)await supabase.from("jugadoras").update(upd).eq("id_jugadora",keepId);
          }
          // Borrar la duplicada
          const {error:delErr}=await supabase.from("jugadoras").delete().eq("id_jugadora",remId);
          if(delErr)throw delErr;
        }else if(mergeTarget.tipo==="equipos"){
          await supabase.from("partidos").update({id_equipo_local:keepId}).eq("id_equipo_local",remId);
          await supabase.from("partidos").update({id_equipo_visitante:keepId}).eq("id_equipo_visitante",remId);
          await supabase.from("partido_boxscore").update({id_equipo:keepId}).eq("id_equipo",remId);
          const {data:remTemp}=await supabase.from("temporadas").select("id,id_jugadora,id_liga,temporada").eq("id_equipo",remId);
          const {data:existTemp}=await supabase.from("temporadas").select("id_jugadora,id_liga,temporada").eq("id_equipo",keepId);
          const existSet=new Set((existTemp||[]).map(t=>t.id_jugadora+"|"+t.id_liga+"|"+t.temporada));
          for(const t of (remTemp||[])){
            if(existSet.has(t.id_jugadora+"|"+t.id_liga+"|"+t.temporada)){
              await supabase.from("temporadas").delete().eq("id",t.id);
            }else{
              await supabase.from("temporadas").update({id_equipo:keepId}).eq("id",t.id);
            }
          }
          await supabase.from("equipos").delete().eq("id_equipo",remId);
        }
      }
      setMergeTarget(null);
      onReload();
      checkNameDupes();
    }catch(e){
      const msg=e?.message||e?.error_description||JSON.stringify(e)||String(e);
      alert("Error al fusionar: "+msg);
      console.error("doMerge error:", e);
    }
    setMerging(false);
  }
  var nameDupesComputed=nameDupesState[0];var setNameDupesComputed=nameDupesState[1];
  var checkNameDupes=function(){
    setDupCheckInfo({checked:false,checking:true});
    setTimeout(function(){
      var result={
        jugadoras:findDupes(players,"nombre","id_jugadora","jugadoras"),
        equipos:findDupes(equipos,"nombre","id_equipo","equipos"),
        ligas:findDupes(ligas,"nombre","id_liga","ligas"),
        coaches:findDupes(coaches,"nombre","id_coach","coaches"),
      };
      setNameDupesComputed(result);
      setDupCheckInfo({checked:true,checking:false});
    },50);
  };
  var nameDupes=nameDupesComputed;
  var totalNameDupes=Object.values(nameDupes).reduce(function(a,d){return a+d.length;},0);
  var ignoreGroup=async function(tipo,group){
    var idKeyMap={jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"};
    var ids=group.items.map(function(it){return it[idKeyMap[tipo]];}).sort().join(",");
    try{
      await supabase.from("duplicados_ignorados").insert({tipo:tipo,clave:group.key,ids:ids});
      setIgnored(function(prev){var s=new Set(prev);s.add(group.gk);return s;});
      setNameDupesComputed(function(prev){
        var copy={};
        Object.keys(prev).forEach(function(k){copy[k]=prev[k].filter(function(g){return g.gk!==group.gk;});});
        return copy;
      });
    }catch(e){alert("Error al guardar: "+(e.message||JSON.stringify(e)));}
  };

  var dupDelState=useState(null);
  var dupDelTarget=dupDelState[0];var setDupDelTarget=dupDelState[1];
  var deleteDupItem=async function(tipo,id){
    var tableMap={jugadoras:"jugadoras",equipos:"equipos",ligas:"ligas",coaches:"coach"};
    var idKeyMap={jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"};
    try{
      if(tipo==="jugadoras")await supabase.from("temporadas").delete().eq("id_jugadora",id);
      if(tipo==="coaches")await supabase.from("temporadas_coach").delete().eq("id_coach",id);
      const{error}=await supabase.from(tableMap[tipo]).delete().eq(idKeyMap[tipo],id);
      if(error)throw error;
      setNameDupesComputed(function(prev){
        var copy={};
        Object.keys(prev).forEach(function(k){
          copy[k]=prev[k].map(function(g){return{...g,items:g.items.filter(function(it){return it[idKeyMap[tipo]]!==id;})};}).filter(function(g){return g.items.length>1;});
        });
        return copy;
      });
      if(tipo==="jugadoras"){setPlayers(prev=>prev.filter(p=>p.id_jugadora!==id));}
      else if(tipo==="equipos"){setEquipos(prev=>prev.filter(e=>e.id_equipo!==id));}
      else if(tipo==="ligas"){setLigas(prev=>prev.filter(l=>l.id_liga!==id));}
      else if(tipo==="coaches"){setCoaches(prev=>prev.filter(c=>c.id_coach!==id));setTempCoach(prev=>prev.filter(tc=>tc.id_coach!==id));}
      setDupDelTarget(null);
    }catch(e){alert("Error al eliminar: "+(e.message||JSON.stringify(e)));}
  };

  function fixDuplicate(group){
    var sorted=[].concat(group).sort(function(a,b){return a.id-b.id;});
    var toDelete=sorted.slice(1).map(function(s){return s.id;});
    var toDeleteSet=new Set(toDelete);
    var fkey=group[0].id_jugadora+group[0].temporada;
    setFixing(fkey);
    (async function(){
      try{
        for(var i=0;i<toDelete.length;i++){
          var r=await supabase.from("temporadas").delete().eq("id",toDelete[i]);
          if(r.error)throw r.error;
        }
        setPlayers(prev=>prev.map(p=>p.id_jugadora!==group[0].id_jugadora?p:{...p,seasons:(p.seasons||[]).filter(s=>!toDeleteSet.has(s.id))}));
      }catch(e){alert("Error: "+(e.message||JSON.stringify(e)));}
      setFixing(null);
    })();
  }


  var subTabState=useState("jugadoras");
  var subTab=subTabState[0];var setSubTab=subTabState[1];
  var issueFilterState=useState("");
  var issueFilter=issueFilterState[0];var setIssueFilter=issueFilterState[1];

  var incompletas=useMemo(function(){
    var p=players.map(function(p){
      var iss=[];
      if(!p.foto)iss.push("Sin foto");
      if(!p.altura_cm)iss.push("Sin altura");
      if(!p.nacionalidad)iss.push("Sin nacionalidad");
      if(!p.posicion)iss.push("Sin posición");
      if(!(p.seasons||[]).length)iss.push("Sin temporadas");
      return iss.length?{tipo:"jugadoras",item:p,nombre:p.nombre,id:p.id_jugadora,issues:iss,onGo:onGoToPlayer}:null;
    }).filter(Boolean);
    var e=equipos.map(function(eq){
      var iss=[];
      if(!eq.escudo)iss.push("Sin escudo");
      if(!eq.pais)iss.push("Sin país");
      if(!eq.ciudad)iss.push("Sin ciudad");
      return iss.length?{tipo:"equipos",item:eq,nombre:eq.nombre,id:eq.id_equipo,issues:iss,onGo:onGoToTeam}:null;
    }).filter(Boolean);
    var l=ligas.map(function(lg){
      var iss=[];
      if(!lg.logo)iss.push("Sin escudo");
      if(!lg.pais)iss.push("Sin país");
      return iss.length?{tipo:"ligas",item:lg,nombre:lg.nombre,id:lg.id_liga,issues:iss,onGo:onGoToLeague}:null;
    }).filter(Boolean);
    var c=coaches.map(function(co){
      var iss=[];
      if(!co.foto)iss.push("Sin foto");
      if(!co.nacionalidad)iss.push("Sin nacionalidad");
      return iss.length?{tipo:"coaches",item:co,nombre:co.nombre,id:co.id_coach,issues:iss,onGo:onGoToCoach}:null;
    }).filter(Boolean);
    var sortFn=function(a,b){return a.nombre.localeCompare(b.nombre,"es");};
    return{jugadoras:p.sort(sortFn),equipos:e.sort(sortFn),ligas:l.sort(sortFn),coaches:c.sort(sortFn)};
  },[players,equipos,ligas,coaches]);
  var incompletasTotal=incompletas.jugadoras.length+incompletas.equipos.length+incompletas.ligas.length+incompletas.coaches.length;

  var duplicadas=useMemo(function(){
    var all=players.flatMap(function(p){return (p.seasons||[]).map(function(s){return Object.assign({},s,{nombre:p.nombre,id_jugadora:p.id_jugadora});});});
    var seen={};
    all.forEach(function(s){
      var k=s.id_jugadora+"|"+s.id_equipo+"|"+s.id_liga+"|"+s.temporada;
      if(!seen[k])seen[k]=[];
      seen[k].push(s);
    });
    return Object.values(seen).filter(function(arr){return arr.length>1;});
  },[players]);

  var huecos=useMemo(function(){
    var allSeasons=players.flatMap(function(p){return p.seasons||[];});
    return{
      jugadoras:checkIdGaps(players,"id_jugadora","J",0),
      equipos:checkIdGaps(equipos,"id_equipo","E",3),
      ligas:checkIdGaps(ligas,"id_liga","L",3),
      coaches:checkIdGaps(coaches,"id_coach","C",3),
      temporadas:checkIdGaps(allSeasons,"id","",0),
      temporadas_coach:checkIdGaps(tempCoach||[],"id","",0),
      palmares:checkIdGaps(palmares||[],"id","",0),
    };
  },[players,equipos,ligas,coaches,tempCoach,palmares]);

  var brokenState=useState({checked:false,checking:false,broken:[],progress:0,total:0});
  var brokenInfo=brokenState[0];var setBrokenInfo=brokenState[1];
  var checkBrokenEscudos=function(){
    var targets=[];
    equipos.forEach(function(e){if(e.escudo)targets.push({tipo:"equipos",id:e.id_equipo,nombre:e.nombre,url:e.escudo,onGo:onGoToTeam});});
    ligas.forEach(function(l){if(l.logo)targets.push({tipo:"ligas",id:l.id_liga,nombre:l.nombre,url:l.logo,onGo:onGoToLeague});});
    if(!targets.length){setBrokenInfo({checked:true,checking:false,broken:[],progress:0,total:0});return;}
    setBrokenInfo({checked:false,checking:true,broken:[],progress:0,total:targets.length});
    var done=0;var broken=[];
    targets.forEach(function(t){
      var img=new window.Image();
      img.onload=function(){done++;setBrokenInfo(function(prev){return{checked:done===targets.length,checking:done!==targets.length,broken:broken.slice(),progress:done,total:targets.length};});};
      img.onerror=function(){done++;broken.push(t);setBrokenInfo(function(prev){return{checked:done===targets.length,checking:done!==targets.length,broken:broken.slice(),progress:done,total:targets.length};});};
      img.src=t.url;
    });
  };

  // Nacionalidades: valores sin bandera, variantes que resuelven al mismo país
  // y jugadoras con nacionalidad2 igual a nacionalidad.
  var nacInfo=useMemo(function(){
    var counts={};
    players.forEach(function(p){
      [p.nacionalidad,p.nacionalidad2].forEach(function(v){
        if(!v||!String(v).trim())return;
        var key=String(v).trim();
        if(!counts[key])counts[key]={count:0,players:[]};
        counts[key].count++;
        if(counts[key].players.length<6)counts[key].players.push(p);
      });
    });
    var sinBandera=[],porCodigo={};
    Object.keys(counts).forEach(function(v){
      var code=countryCode(v);
      var normV=v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
      if(code){
        if(!porCodigo[code])porCodigo[code]=[];
        porCodigo[code].push({valor:v,count:counts[v].count});
      }else if(!NO_COUNTRY_FLAGS[normV]){
        sinBandera.push({valor:v,count:counts[v].count,players:counts[v].players});
      }
    });
    var variantes=Object.keys(porCodigo).filter(function(c){return porCodigo[c].length>1;}).map(function(c){
      return {code:c,variantes:porCodigo[c].sort(function(a,b){return b.count-a.count;})};
    });
    var nacDup=players.filter(function(p){
      if(!p.nacionalidad||!p.nacionalidad2)return false;
      var c1=countryCode(p.nacionalidad),c2=countryCode(p.nacionalidad2);
      return (c1&&c1===c2)||String(p.nacionalidad).trim().toLowerCase()===String(p.nacionalidad2).trim().toLowerCase();
    });
    sinBandera.sort(function(a,b){return b.count-a.count;});
    return {sinBandera:sinBandera,variantes:variantes,nacDup:nacDup};
  },[players]);

  // Fotos placeholder: jugadoras y técnicos que aún tienen la silueta por defecto de Flashscore
  var fotosPlaceholder=useMemo(function(){
    var re=/empty-face-(woman|man)-share\.gif/;
    var jug=players.filter(function(p){return p.foto&&re.test(p.foto);}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
    var tec=(coaches||[]).filter(function(c){return c.foto&&re.test(c.foto);}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
    return {jug:jug,tec:tec};
  },[players,coaches]);

  var CAL_GROUPS=[
    {title:"📇 Fichas",items:[
      {key:"incompletas",label:"Incompletas",count:incompletasTotal},
      {key:"duplicados_nombre",label:"Duplicados nombre",count:totalNameDupes},
      {key:"nacionalidades",label:"Nacionalidades",count:nacInfo.sinBandera.length+nacInfo.variantes.length+nacInfo.nacDup.length},
      ...(isAdmin?[{key:"lleno_fiba",label:"Rellenar desde FIBA",count:llenoResults?.conDiff?.length||0}]:[]),
    ]},
    {title:"🎬 Fotos & escudos",items:[
      {key:"fotos",label:"Placeholders",count:fotosPlaceholder.jug.length+fotosPlaceholder.tec.length},
      {key:"escudos_rotos",label:"Escudos rotos",count:brokenInfo.broken.length},
      ...(isAdmin?[{key:"fotos_fiba",label:"Fotos → FIBA",count:fibaResults?.altos?.length||0}]:[]),
    ]},
    {title:"📅 Estructura",items:[
      {key:"duplicadas",label:"Temp. duplicadas",count:(duplicadas||[]).length},
      {key:"huecos",label:"Huecos IDs",count:0},
    ]},
    ...(isAdmin?[{title:"🛠 Alta masiva",items:[
      {key:"scraper",label:"Scraper FIBA",count:0},
      {key:"feb-fichas",label:"Rellenar desde FEB",count:febPend||0},
      {key:"carreras",label:"🎓 Carreras jugadoras",count:0},
      {key:"lotes",label:"Alta por lotes",count:0},
      {key:"genius",label:"🔗 Genius Match",count:0},
    ]},{title:"🩺 Ops",items:[
      {key:"estado",label:"Estado sistema",count:0},
    ]}]:[]),
  ];
  var CAL_TABS=CAL_GROUPS.flatMap(g=>g.items);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background: "var(--fx-card)",borderRadius:"20px",width:"600px",maxWidth:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"24px 24px 16px"}}>
          <div>
            <h2 style={{fontWeight:800,fontSize:"18px",color: "var(--fx-text)",margin:0}}>🩺 Calidad de datos</h2>
            <p style={{fontSize:"12px",color: "var(--fx-muted2)",margin:"4px 0 0"}}>Revisión de integridad de la base de datos</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{background:"none",border:"none",fontSize:"22px",color: "var(--fx-muted2)",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"0 24px 12px",borderBottom:"1px solid var(--fx-border2)"}}>
          <div style={{display:"flex",gap:"4px",marginBottom:"8px",flexWrap:"wrap"}}>
            {CAL_GROUPS.map(function(g,gi){
              var active=g.items.some(function(t){return t.key===tab;});
              var totalCount=g.items.reduce(function(a,t){return a+t.count;},0);
              return(
                <button key={gi} onClick={function(){setTab(g.items[0].key);}}
                  style={{background:active?"#9333ea":"var(--fx-hover)",color:active?"#fff":"#64748b",border:active?"none":"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"7px 14px",cursor:"pointer",fontSize:"12px",fontWeight:700,whiteSpace:"nowrap"}}>
                  {g.title}
                  {totalCount>0&&<span style={{display:"inline-block",marginLeft:"4px",background:active?"rgba(255,255,255,0.3)":"#ef4444",color:"#fff",borderRadius:"10px",padding:"0 5px",fontSize:"9px"}}>{totalCount}</span>}
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
            {(CAL_GROUPS.find(function(g){return g.items.some(function(t){return t.key===tab;});})||CAL_GROUPS[0]).items.map(function(t){return(
              <button key={t.key} onClick={function(){setTab(t.key);}}
                style={{background:tab===t.key?"var(--fx-amber-bg)":"transparent",border:tab===t.key?"1.5px solid #fed7aa":"1.5px solid transparent",borderRadius:"8px",padding:"5px 10px",cursor:"pointer",fontSize:"11px",fontWeight:700,color:tab===t.key?"var(--fx-amber-text)":"#94a3b8",whiteSpace:"nowrap"}}>
                {t.label}
                {t.count>0&&<span style={{display:"inline-block",marginLeft:"3px",background:"#ef4444",color:"#fff",borderRadius:"10px",padding:"0 5px",fontSize:"9px"}}>{t.count}</span>}
              </button>
            );})}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px 24px"}}>
          {tab==="scraper"&&(
            <div>
              <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>Carga boxscores (estadísticas por jugadora) y parciales por cuarto de una competición FIBA leyendo directamente los datos oficiales del site. Puede crear también los partidos que falten con su fase y resultado. Solo procesa partidos que <b>ya tienen resultado</b>; las jugadoras deben existir ya en sus temporadas. Si tarda mucho o se corta, vuelve a pulsar: continúa donde lo dejó.</p>
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <label style={{fontSize:"12px",fontWeight:700,color: "var(--fx-label)"}}>Liga
                  <select value={scLiga} onChange={function(e){onScLiga(e.target.value);}} style={{width:"100%",marginTop:"4px",padding:"9px 10px",borderRadius:"10px",border:"1px solid var(--fx-border)",fontSize:"13px",background: "var(--fx-card)"}}>
                    <option value="">— elige liga —</option>
                    {ligas.slice().sort(function(a,b){return (a.nombre||"").localeCompare(b.nombre||"");}).map(function(l){return <option key={l.id_liga} value={l.id_liga}>{l.nombre} ({l.id_liga})</option>;})}
                  </select>
                </label>
                <label style={{fontSize:"12px",fontWeight:700,color: "var(--fx-label)"}}>Temporada
                  <input value={scTemp} onChange={function(e){onScTemp(e.target.value);}} placeholder="2026  ·  ó  2025-26" style={{width:"100%",marginTop:"4px",padding:"9px 10px",borderRadius:"10px",border:"1px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box"}}/>
                </label>
                <label style={{fontSize:"12px",fontWeight:700,color: "var(--fx-label)"}}>Slug del evento FIBA
                  <input value={scSlug} onChange={function(e){setScSlug(e.target.value);}} placeholder="fiba-u17-womens-basketball-world-cup-2026" style={{width:"100%",marginTop:"4px",padding:"9px 10px",borderRadius:"10px",border:"1px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box",fontFamily:"monospace"}}/>
                  <span style={{display:"block",fontWeight:400,color: "var(--fx-muted2)",fontSize:"11px",marginTop:"3px"}}>Se rellena solo si la liga tiene plantilla guardada (y puedes editarlo). Es el trozo de la URL de FIBA: fiba.basketball/en/events/<b>este-trozo</b>/games</span>
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color: "var(--fx-label)",cursor:"pointer"}}>
                  <input type="checkbox" checked={scDry} onChange={function(e){setScDry(e.target.checked);}}/> Prueba (dry-run): no escribe nada, solo informa de lo que haría
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color: "var(--fx-label)",cursor:"pointer"}}>
                  <input type="checkbox" checked={scCrear} onChange={function(e){setScCrear(e.target.checked);}}/> Crear también los partidos que falten (los baja de la lista del evento y mapea equipos por nombre)
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color: "var(--fx-label)",cursor:"pointer"}}>
                  <input type="checkbox" checked={scForce} onChange={function(e){setScForce(e.target.checked);}}/> Force: reescribir boxscores que ya existen (borra y vuelve a cargar las filas del partido)
                </label>
                <button onClick={runScraper} disabled={scBusy||!scLiga||!scSlug.trim()} style={{background:scBusy||!scLiga||!scSlug.trim()?"#cbd5e1":(scDry?"#0f172a":"#9333ea"),color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"13px",cursor:scBusy||!scLiga||!scSlug.trim()?"default":"pointer"}}>{scBusy?"Scrapeando… (puede tardar)":(scDry?"▶ Probar":"⬇️ Scrapear boxscores")}</button>
              </div>
              {scRes&&<ScraperResult res={scRes} busy={scBusy}/>}
            </div>
          )}
          {tab==="feb-fichas"&&(
            <div>
              <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>Rellena <b>fecha_nac, altura, posición y nacionalidad</b> de jugadoras que tienen <code>id_feb</code> pero les faltan datos, scrapeando su ficha oficial en baloncestoenvivo.feb.es. Cada lote agrupa por partido para optimizar créditos de ScraperAPI.</p>
              <div style={{background:"var(--fx-amber-bg)",border:"1px solid #fed7aa",borderRadius:"10px",padding:"10px 12px",marginBottom:"12px",fontSize:"12px",color:"#9a3412"}}>
                📊 <b>{febPend==null?"…":febPend}</b> jugadoras pendientes con <code>id_feb</code> y sin <code>fecha_nac</code>.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <label style={{fontSize:"12px",fontWeight:700,color: "var(--fx-label)"}}>Jugadoras por lote
                  <input type="number" min="1" max="50" value={febLimit} onChange={function(e){setFebLimit(parseInt(e.target.value)||5);}} style={{width:"100%",marginTop:"4px",padding:"9px 10px",borderRadius:"10px",border:"1px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box"}}/>
                  <span style={{display:"block",fontWeight:400,color: "var(--fx-muted2)",fontSize:"11px",marginTop:"3px"}}>Cada lote hace 1 scrape por partido compartido + 1 por ficha (~2 créditos ScraperAPI por jugadora)</span>
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color: "var(--fx-label)",cursor:"pointer"}}>
                  <input type="checkbox" checked={febDry} onChange={function(e){setFebDry(e.target.checked);}}/> Prueba (dry-run): no escribe, solo informa
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color: "var(--fx-label)",cursor:"pointer"}}>
                  <input type="checkbox" checked={febLoop} onChange={function(e){setFebLoop(e.target.checked);}}/> Loop: repetir hasta procesar todas las pendientes
                </label>
                <button onClick={runFebEnriq} disabled={febBusy} style={{background:febBusy?"#cbd5e1":(febDry?"#0f172a":"#9333ea"),color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"13px",cursor:febBusy?"default":"pointer"}}>{febBusy?"Enriqueciendo…":(febDry?"▶ Probar":"⬇️ Enriquecer fichas")}</button>
              </div>
              {febRes&&(
                <div style={{marginTop:"16px",background: "var(--fx-hover)",border:"1px solid var(--fx-border)",borderRadius:"12px",padding:"14px"}}>
                  {febRes.error?<div style={{color:"#ef4444",fontSize:"13px"}}>❌ {febRes.error}</div>:(
                    <div style={{fontSize:"13px",color:"var(--fx-text)"}}>
                      <div style={{fontWeight:700,marginBottom:"4px"}}>{febDry?"🔎 Prueba · ":"✅ "}Candidatas: {febRes.candidatas} · Partidos scrapeados: {febRes.partidos_scrapeados} · Actualizadas: {febRes.fichas_actualizadas}{febRes.iter>1?` · Lotes: ${febRes.iter}`:""}</div>
                      {febRes.errores&&febRes.errores.length>0&&<div style={{marginTop:"8px",color:"#dc2626",fontSize:"12px"}}><b>Errores ({febRes.errores.length})</b>: {febRes.errores.join(" · ")}</div>}
                      {febRes.resultados&&febRes.resultados.length>0&&<ul style={{margin:"8px 0 0",paddingLeft:"18px",maxHeight:"260px",overflowY:"auto",fontSize:"12px"}}>{febRes.resultados.slice(0,120).map(function(r,i){return <li key={i} style={{marginBottom:"3px",color:r.error?"var(--fx-amber-text)":"#0f766e"}}>{r.nombre} → {r.fecha_nac||"—"} · {r.altura_cm||"—"}cm · {r.posicion||"—"} · {r.nacionalidad||"—"}{r.error?` (${r.error})`:""}</li>;})}</ul>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {tab==="carreras"&&(
            <div style={{padding:"16px"}}>
              <h3 style={{fontWeight:800,fontSize:"15px",color: "var(--fx-text)",margin:"0 0 4px"}}>🎓 Carreras por roster</h3>
              <p style={{fontSize:"12px",color: "var(--fx-muted)",margin:"0 0 12px"}}>Selecciona un equipo. Analiza su roster, auto-mapea IDs externos (ESPN/LFB) y carga las carreras completas de todas sus jugadoras.</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 100px",gap:"8px",marginBottom:"12px"}}>
                <select value={carrLiga} onChange={e=>setCarrLiga(e.target.value)} style={{padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}>
                  <option value="L020">NCAA (L020)</option>
                  <option value="L006">WNBA (L006)</option>
                  <option value="L007">LFB Francia (L007)</option>
                  <option value="L022">LF2 Francia (L022)</option>
                  <option value="L098">Copa Francia (L098)</option>
                  <option value="L001">LF Endesa (L001)</option>
                  <option value="L002">LF Challenge (L002)</option>
                  <option value="L003">LF2 (L003)</option>
                  <option value="L055">Mundial FIBA (L055)</option>
                  <option value="L027">EuroBasket (L027)</option>
                  <option value="L060">Olímpicos (L060)</option>
                  <option value="L004">EuroLeague Women (L004)</option>
                  <option value="L005">EuroCup Women (L005)</option>
                </select>
                <select value={carrEquipoId} onChange={e=>setCarrEquipoId(e.target.value)} style={{padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}>
                  <option value="">Equipo...</option>
                  {carrEquiposLiga.map(function(e){return <option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>;})}
                </select>
                <input value={carrTemp} onChange={e=>setCarrTemp(e.target.value)} placeholder="2025-26" style={{padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}/>
              </div>
              <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
                <button onClick={carrAnalizar} disabled={!!carrBusy||!carrEquipoId} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:carrBusy||!carrEquipoId?0.5:1}}>{carrBusy==="info"?"Analizando...":"🔍 Analizar roster"}</button>
                {carrInfo&&!carrInfo.error&&!["L007","L022","L098","L001","L002","L003","L017","L074","L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga)&&carrInfo.mapeados>0&&<button onClick={carrMapear} disabled={!!carrBusy} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="mapear"?"Mapeando...":"🔗 Auto-mapear "+carrInfo.mapeados+" faltante(s)"}</button>}
                {carrInfo&&!carrInfo.error&&!["L007","L022","L098","L001","L002","L003","L017","L074","L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga)&&(carrInfo.solo_en_espn_obj?.length||carrInfo.solo_en_espn?.length)>0&&<button onClick={carrCrearFaltantes} disabled={!!carrBusy} style={{background:"#0ea5e9",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="crear"?"Creando...":"➕ Crear "+(carrInfo.solo_en_espn_obj?.length||carrInfo.solo_en_espn?.length)+" jugadora(s) con esta temporada"}</button>}
                {carrInfo&&!carrInfo.error&&<button onClick={()=>carrCargar(true)} disabled={!!carrBusy} style={{background:"#64748b",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="dry"?"Dry run...":"🧪 Dry run"}</button>}
                {carrInfo&&!carrInfo.error&&<button onClick={()=>carrCargar(false)} disabled={!!carrBusy} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="cargar"?"Cargando...":"🚀 Cargar carreras"}</button>}
              </div>
              <div style={{padding:"10px 12px",background:"var(--fx-lila-bg)",border:"1px solid #e9d5ff",borderRadius:"10px",marginBottom:"12px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:"#7c3aed",marginBottom:"6px"}}>🌐 Modo liga completa ({carrEquiposLiga.length} equipos en {carrTemp})</div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  <button onClick={ligaAnalizar} disabled={!!carrBusy||!carrEquiposLiga.length} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:carrBusy||!carrEquiposLiga.length?0.5:1}}>{carrBusy==="liga_info"?"Analizando...":"🔍 Analizar TODA la liga"}</button>
                  {ligaInfo&&!["L007","L022","L098","L001","L002","L003","L017","L074","L004","L005","L027","L055","L056","L060","L058","L057","L059","L067","L071","L075","L076","L083","L091","L099","L079","L096","L087","L077","L093","L078","L080","L081","L082","L085","L104","L105","L110"].includes(carrLiga)&&<button onClick={ligaCrearYMapear} disabled={!!carrBusy} style={{background:"#0ea5e9",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="liga_crear"?"Creando...":"➕ Crear/mapear todo"}</button>}
                  {ligaInfo&&<button onClick={ligaCargarCarreras} disabled={!!carrBusy} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="liga_cargar"?"Cargando...":"🚀 Cargar TODAS las carreras"}</button>}
                  {carrLiga==="L007"&&<button onClick={refrescarFechasLfb} disabled={!!carrBusy} title="Scrapea el calendario general LBWL y actualiza fecha_hora de los partidos (22 requests Firecrawl)" style={{background:"#0891b2",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="fechas_lfb"?"Refrescando...":"🕐 Refrescar fechas LFB"}</button>}
                  {["L001","L002","L003","L017","L074"].includes(carrLiga)&&<button onClick={mapearIdExtFeb} disabled={!!carrBusy} title="Rellena temporadas.id_ext_feb para jugadoras que aún no lo tienen (agrupa por partido, ~5-15 min por temporada)" style={{background:"#0891b2",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:carrBusy?0.5:1}}>{carrBusy==="mapear_ie_feb"?"Mapeando...":"🔗 Mapear id_ext_feb"}</button>}
                  {ligaInfo&&<label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color: "var(--fx-label)",cursor:"pointer",background: "var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"7px 10px"}}>
                    <input type="checkbox" checked={skipCargadas} onChange={e=>setSkipCargadas(e.target.checked)}/>
                    Saltar ya cargadas
                  </label>}
                </div>
                {ligaProgress.total>0&&<div style={{marginTop:"6px",fontSize:"11px",color: "var(--fx-muted)"}}>{ligaProgress.paso} · {ligaProgress.done}/{ligaProgress.total}</div>}
                {ligaInfo&&<div style={{marginTop:"8px",maxHeight:"200px",overflowY:"auto",fontSize:"11px",background: "var(--fx-card)",border:"1px solid #e9d5ff",borderRadius:"8px"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#f5f3ff",color: "var(--fx-muted)",fontSize:"10px"}}>
                      <th style={{padding:"4px 6px",textAlign:"left"}}>Equipo</th>
                      <th style={{padding:"4px 6px"}}>BD</th>
                      <th style={{padding:"4px 6px"}}>ESPN</th>
                      <th style={{padding:"4px 6px"}}>Mapear</th>
                      <th style={{padding:"4px 6px"}}>Crear</th>
                      <th style={{padding:"4px 6px"}}>Estado</th>
                    </tr></thead>
                    <tbody>
                      {ligaInfo.map((e,i)=>{
                        const nFaltan=e.solo_en_espn_obj?.length||0;
                        return[
                          <tr key={i} style={{borderTop:"1px solid var(--fx-border2)"}}>
                            <td style={{padding:"4px 6px",color: "var(--fx-text)",fontWeight:600}}>{e.equipo}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",color: "var(--fx-muted)"}}>{e.bd_total}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",color: "var(--fx-muted)"}}>{e.espn_total}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",color:e.mapeados?"#f59e0b":"#94a3b8",fontWeight:e.mapeados?700:400}}>{e.mapeados||0}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",color:nFaltan?"#0ea5e9":"#94a3b8",fontWeight:nFaltan?700:400}}>{nFaltan}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",fontSize:"10px",color:e.error?"#ef4444":e.creadas!=null?"#16a34a":"#94a3b8"}}>{e.error?"❌ "+e.error:e.creadas!=null?"✅ "+e.creadas+"+"+e.adjuntadas:"—"}</td>
                          </tr>,
                          nFaltan>0&&<tr key={i+"-d"}><td colSpan={6} style={{padding:"2px 8px 6px 20px",background:"var(--fx-hover)",fontSize:"10px",color: "var(--fx-label)"}}>
                            <div style={{fontWeight:700,color:"#0ea5e9",marginBottom:"2px"}}>Faltan en BD:</div>
                            {e.solo_en_espn_obj.map((s,k)=><span key={k} style={{display:"inline-block",marginRight:"10px"}}>
                              <a href={"https://www.espn.com/wnba/player/_/id/"+s.id} target="_blank" rel="noreferrer" style={{color:"#0ea5e9",textDecoration:"none"}}>{s.nombre}</a>
                              <span style={{color: "var(--fx-muted2)"}}> ({s.id})</span>
                            </span>)}
                          </td></tr>
                        ];
                      })}
                    </tbody>
                  </table>
                </div>}
              </div>
              {carrInfo&&(carrInfo.error?<div style={{background:"var(--fx-red-bg)",border:"1px solid #fecaca",color:"#dc2626",padding:"10px",borderRadius:"10px",fontSize:"13px"}}>❌ {carrInfo.error}</div>:
                <div style={{background: "var(--fx-hover)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"12px",marginBottom:"12px"}}>
                  <div style={{fontSize:"13px",marginBottom:"8px"}}><b>{carrInfo.equipo}</b> · BD: {carrInfo.bd_total} · ESPN: {carrInfo.espn_total} · Ya con id_espn: {carrInfo.ya_con_espn} · A mapear: {carrInfo.mapeados}</div>
                  {carrInfo.roster&&carrInfo.roster.length>0&&<div style={{maxHeight:"180px",overflowY:"auto",fontSize:"12px"}}>
                    {carrInfo.roster.map(function(r,i){return <div key={i} style={{padding:"3px 0",borderBottom:"1px solid var(--fx-border2)",display:"flex",justifyContent:"space-between",gap:"8px"}}><span>{r.id_espn?"🟢":(r.espn_match?"🟡":"⚪")} {r.nombre}</span><span style={{color: "var(--fx-muted2)",fontFamily:"monospace",fontSize:"11px"}}>{r.id_espn||r.espn_match?.id||"—"}</span></div>;})}
                  </div>}
                  {carrInfo.sin_match_bd?.length>0&&<div style={{marginTop:"8px",fontSize:"12px",color:"#dc2626"}}>⚠️ Sin match en ESPN ({carrInfo.sin_match_bd.length}): {carrInfo.sin_match_bd.join(", ")}</div>}
                  {carrInfo.solo_en_espn?.length>0&&<details style={{marginTop:"8px"}}><summary style={{fontSize:"12px",color: "var(--fx-muted)",cursor:"pointer"}}>ESPN tiene {carrInfo.solo_en_espn.length} no en BD</summary><div style={{fontSize:"11px",color: "var(--fx-label)",maxHeight:"120px",overflowY:"auto"}}>{carrInfo.solo_en_espn.map(function(s,i){return <div key={i}>{s}</div>;})}</div></details>}
                </div>
              )}
              {carrLog.length>0&&<div style={{background: "var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"12px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color: "var(--fx-muted)",marginBottom:"8px"}}>Progreso ({carrLog.length}/{carrInfo?.roster?.filter(function(r){return r.id_espn||r.espn_match;}).length||0})</div>
                <div style={{maxHeight:"260px",overflowY:"auto",fontSize:"12px"}}>
                  {carrLog.map(function(l,i){return <div key={i} style={{padding:"3px 0",display:"flex",justifyContent:"space-between",gap:"8px"}}><span>{l.jugadora}</span><span style={{color: "var(--fx-label)",fontSize:"11px"}}>{l.estado}</span></div>;})}
                </div>
              </div>}
            </div>
          )}
                    {tab==="lotes"&&(
            <div style={{padding:"16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"14px"}}>
                <div>
                  <label style={{fontSize:"11px",fontWeight:700,color: "var(--fx-muted)",marginBottom:"4px",display:"block"}}>EQUIPO</label>
                  <select value={lotEquipo} onChange={e=>setLotEquipo(e.target.value)} style={{width:"100%",padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}>
                    <option value="">Seleccionar...</option>
                    {equipos.sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"")).map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:"11px",fontWeight:700,color: "var(--fx-muted)",marginBottom:"4px",display:"block"}}>LIGA</label>
                  <select value={lotLiga} onChange={e=>setLotLiga(e.target.value)} style={{width:"100%",padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}>
                    <option value="">Seleccionar...</option>
                    {ligas.sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"")).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:"11px",fontWeight:700,color: "var(--fx-muted)",marginBottom:"4px",display:"block"}}>TEMPORADA</label>
                  <input value={lotTemp} onChange={e=>setLotTemp(e.target.value)} placeholder="2025-26" style={{width:"100%",padding:"8px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",fontWeight:700,color: "var(--fx-muted)",marginBottom:"4px",display:"block"}}>JUGADORAS (una por línea)</label>
                <textarea value={lotTexto} onChange={e=>setLotTexto(e.target.value)} rows={12} placeholder={"Lauren Betts\nKiki Rice\nGabriela Jaquez\n..."} style={{width:"100%",padding:"10px",borderRadius:"8px",border:"1.5px solid var(--fx-border)",fontSize:"13px",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
              </div>
              <button onClick={runLotes} disabled={lotBusy} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 24px",fontWeight:700,fontSize:"14px",cursor:"pointer",opacity:lotBusy?0.5:1}}>
                {lotBusy?"Procesando...":"Procesar lista"}
              </button>
              {lotRes&&<div style={{marginTop:"16px",background: "var(--fx-hover)",borderRadius:"12px",padding:"14px",border:"1px solid var(--fx-border)"}}>
                {lotRes.error?<div style={{color:"#ef4444",fontWeight:700}}>{lotRes.error}</div>:<>
                  <div style={{fontSize:"13px",marginBottom:"8px"}}><strong>{lotRes.total}</strong> nombres procesados</div>
                  {lotRes.anadidas.length>0&&<div style={{marginBottom:"8px"}}>
                    <div style={{fontSize:"12px",fontWeight:700,color:"#16a34a",marginBottom:"4px"}}>✅ Añadidas ({lotRes.anadidas.length}):</div>
                    {lotRes.anadidas.map((n,i)=><div key={i} style={{fontSize:"12px",color: "var(--fx-label)",paddingLeft:"12px"}}>{n}</div>)}
                  </div>}
                  {lotRes.yaEstaban.length>0&&<div style={{marginBottom:"8px"}}>
                    <div style={{fontSize:"12px",fontWeight:700,color:"#f59e0b",marginBottom:"4px"}}>⚠️ Ya estaban ({lotRes.yaEstaban.length}):</div>
                    {lotRes.yaEstaban.map((n,i)=><div key={i} style={{fontSize:"12px",color: "var(--fx-label)",paddingLeft:"12px"}}>{n}</div>)}
                  </div>}
                  {lotRes.noEncontradas.length>0&&<div>
                    <div style={{fontSize:"12px",fontWeight:700,color:"#ef4444",marginBottom:"4px"}}>❌ No encontradas ({lotRes.noEncontradas.length}):</div>
                    {lotRes.noEncontradas.map((n,i)=><div key={i} style={{fontSize:"12px",color: "var(--fx-label)",paddingLeft:"12px"}}>{n}</div>)}
                  </div>}
                </>}
              </div>}
            </div>
          )}
          {tab==="genius"&&<GeniusMatchTab ligas={ligas} equipos={equipos} setEquipos={setEquipos} setLigas={setLigas}/>}
          {tab==="lleno_fiba"&&(
            <div style={{padding:"4px"}}>
              <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>
                Consulta la ficha oficial FIBA de cada jugadora con <code style={{background: "var(--fx-hover)",padding:"1px 5px",borderRadius:"4px",fontSize:"11px"}}>fiba_person_id</code> guardado y compara <b>fecha de nacimiento</b> con la BD. Los cambios se aplican y quedan revertibles. La nacionalidad se muestra solo como aviso.
              </p>
              {!llenoResults&&(
                <div style={{display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={runLlenoScan} disabled={llenoBusy}
                    style={{background:llenoBusy?"#cbd5e1":"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"13px",cursor:llenoBusy?"default":"pointer"}}>
                    {llenoBusy?`🔎 Escaneando… ${llenoProgress.done}/${llenoProgress.total}`:"🔍 Escanear datos FIBA"}
                  </button>
                  {llenoLastBatchId&&(
                    <button onClick={()=>revertLlenoBatch(llenoLastBatchId)}
                      style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 16px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                      ↩ Revertir último lote
                    </button>
                  )}
                </div>
              )}
              {llenoResults?.error&&<div style={{marginTop:"12px",color:"#ef4444",fontSize:"13px"}}>❌ {llenoResults.error}</div>}
              {llenoResults&&!llenoResults.error&&(
                <div>
                  <div style={{display:"flex",gap:"8px",marginBottom:"14px",alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{fontSize:"13px",color:"var(--fx-text)"}}>
                      Con diferencias: <b>{llenoResults.conDiff.length}</b> · Sin cambios: <b>{llenoResults.sinDiff.length}</b> · Errores: <b>{llenoResults.errores.length}</b>
                    </div>
                    <button onClick={function(){setLlenoResults(null);setLlenoApplyRes(null);}}
                      style={{marginLeft:"auto",background:"transparent",color: "var(--fx-muted2)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"6px 12px",cursor:"pointer",fontSize:"12px"}}>
                      Reset
                    </button>
                  </div>
                  {llenoResults.conDiff.length>0&&(
                    <div style={{display:"flex",gap:"8px",marginBottom:"14px",alignItems:"center",flexWrap:"wrap"}}>
                      <button onClick={function(){
                          if(llenoConfirmKey==="all"){applyLlenoBatch(llenoResults.conDiff);}
                          else{setLlenoConfirmKey("all");}
                        }} disabled={llenoApplying}
                        style={{background:llenoApplying?"#cbd5e1":(llenoConfirmKey==="all"?"#dc2626":"#16a34a"),color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"14px",cursor:llenoApplying?"default":"pointer"}}>
                        {llenoApplying?"Aplicando…":(llenoConfirmKey==="all"?`⚠️ Pulsa otra vez para confirmar (${llenoResults.conDiff.length})`:`✅ Aplicar todas (${llenoResults.conDiff.length})`)}
                      </button>
                      {llenoConfirmKey==="all"&&!llenoApplying&&<button onClick={function(){setLlenoConfirmKey(null);}} style={{background:"transparent",color: "var(--fx-muted2)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"11px 16px",cursor:"pointer",fontSize:"12px"}}>Cancelar</button>}
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                    {llenoResults.conDiff.map(function(e){
                      const cambios=Object.keys(e.diffs);
                      return(
                        <div key={e.p.id_jugadora} style={{padding:"10px 12px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)"}}>
                          <div style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"6px"}}>
                            <div style={{flex:1,fontWeight:700,fontSize:"13px"}}>{e.p.nombre}</div>
                            <button onClick={function(){applyLlenoBatch([e]);}} disabled={llenoApplying}
                              style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:llenoApplying?"default":"pointer"}}>
                              Aplicar
                            </button>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                            {cambios.map(function(campo){
                              const d=e.diffs[campo];
                              const bg=d.soloAviso?"var(--fx-amber-hover)":"var(--fx-blue-bg)";
                              const fg=d.soloAviso?"#92400e":"#1e40af";
                              return(
                                <div key={campo} style={{background:bg,color:fg,padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:700}}>
                                  {campo}: <span style={{textDecoration:"line-through",opacity:0.7}}>{d.de==null?"—":String(d.de)}</span> → <b>{String(d.a)}</b>{d.soloAviso&&" (aviso)"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {llenoResults.conDiff.length===0&&(
                      <div style={{textAlign:"center",padding:"30px 0",color: "var(--fx-muted2)"}}>✅ Ninguna jugadora tiene datos distintos de FIBA.</div>
                    )}
                  </div>
                  {llenoApplyRes&&(
                    <div style={{marginTop:"14px",padding:"12px",background:llenoApplyRes.error?"var(--fx-red-bg)":"var(--fx-green-bg)",borderRadius:"10px",border:"1px solid "+(llenoApplyRes.error?"var(--fx-red-border)":"#bbf7d0"),fontSize:"13px"}}>
                      {llenoApplyRes.error?<>❌ {llenoApplyRes.error}</>:<>✅ Aplicadas <b>{llenoApplyRes.ok}</b> jugadoras · <b>{llenoApplyRes.campos}</b> campos actualizados</>}
                    </div>
                  )}
                  {llenoResults.errores.length>0&&(
                    <details style={{marginTop:"12px"}}>
                      <summary style={{fontSize:"12px",color: "var(--fx-muted2)",cursor:"pointer"}}>⚠️ Errores ({llenoResults.errores.length})</summary>
                      <div style={{maxHeight:"120px",overflowY:"auto",fontSize:"11px",color: "var(--fx-muted)",marginTop:"4px"}}>
                        {llenoResults.errores.map(function(er,i){return <div key={i}>{er.p.nombre}: {er.err}</div>;})}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
          {tab==="fotos_fiba"&&(
            <div style={{padding:"4px"}}>
              <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>
                Busca fotos oficiales en FIBA para las jugadoras cuya foto guardada es de <b>proballers.com</b> (el 100% de esas URLs devuelve 404). Solo se procesan jugadoras con <b>fecha de nacimiento y nacionalidad</b> en la ficha — imprescindibles para el matching seguro.
              </p>
              {!fibaResults&&(
                <div style={{display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={runFibaScan} disabled={fibaBusy}
                    style={{background:fibaBusy?"#cbd5e1":"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"13px",cursor:fibaBusy?"default":"pointer"}}>
                    {fibaBusy?`🔎 Escaneando… ${fibaProgress.done}/${fibaProgress.total}`:"🔍 Escanear jugadoras con foto rota"}
                  </button>
                  {fibaLastBatchId&&(
                    <button onClick={()=>revertFibaBatch(fibaLastBatchId)}
                      style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 16px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                      ↩ Revertir último lote
                    </button>
                  )}
                </div>
              )}
              {fibaResults?.error&&<div style={{marginTop:"12px",color:"#ef4444",fontSize:"13px"}}>❌ {fibaResults.error}</div>}
              {fibaResults&&!fibaResults.error&&(
                <div>
                  <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
                    {[["altos",`✅ Confianza alta (${fibaResults.altos.length})`],["medios",`⚠️ Revisar (${fibaResults.medios.length})`],["bajos",`❌ Sin match (${fibaResults.bajos.length})`]].map(function(t){return(
                      <button key={t[0]} onClick={function(){setFibaSubTab(t[0]);}}
                        style={{background:fibaSubTab===t[0]?"#9333ea":"#f1f5f9",color:fibaSubTab===t[0]?"#fff":"#475569",border:"none",borderRadius:"10px",padding:"7px 14px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
                        {t[1]}
                      </button>
                    );})}
                    <button onClick={function(){setFibaResults(null);setFibaApplyRes(null);}}
                      style={{marginLeft:"auto",background:"transparent",color: "var(--fx-muted2)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"7px 14px",cursor:"pointer",fontSize:"12px"}}>
                      Reset
                    </button>
                  </div>
                  {fibaSubTab==="altos"&&(
                    <div>
                      {fibaResults.altos.length===0?
                        <div style={{textAlign:"center",padding:"30px 0",color: "var(--fx-muted2)"}}>Sin candidatas de confianza alta.</div>:
                        <>
                          <div style={{display:"flex",gap:"8px",marginBottom:"14px",alignItems:"center"}}>
                            <button onClick={function(){
                                if(fibaConfirmKey==="altos"){applyFibaBatch(fibaResults.altos);}
                                else{setFibaConfirmKey("altos");}
                              }} disabled={fibaApplying}
                              style={{background:fibaApplying?"#cbd5e1":(fibaConfirmKey==="altos"?"#dc2626":"#16a34a"),color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontWeight:700,fontSize:"14px",cursor:fibaApplying?"default":"pointer"}}>
                              {fibaApplying?"Aplicando…":(fibaConfirmKey==="altos"?`⚠️ Pulsa otra vez para confirmar (${fibaResults.altos.length})`:`✅ Aplicar todas (${fibaResults.altos.length})`)}
                            </button>
                            {fibaConfirmKey==="altos"&&!fibaApplying&&<button onClick={function(){setFibaConfirmKey(null);}} style={{background:"transparent",color: "var(--fx-muted2)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"11px 16px",cursor:"pointer",fontSize:"12px"}}>Cancelar</button>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {fibaResults.altos.slice(0,15).map(function(e){return(
                              <FibaRow key={e.p.id_jugadora} entry={e} onApply={function(){applyFibaBatch([e]);}} showActions={false}/>
                            );})}
                            {fibaResults.altos.length>15&&<div style={{fontSize:"12px",color: "var(--fx-muted2)",padding:"6px"}}>… y {fibaResults.altos.length-15} más (todas se aplican con el botón).</div>}
                          </div>
                        </>
                      }
                    </div>
                  )}
                  {fibaSubTab==="medios"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      {fibaResults.medios.length===0?
                        <div style={{textAlign:"center",padding:"30px 0",color: "var(--fx-muted2)"}}>Sin candidatas para revisar.</div>:
                        fibaResults.medios.map(function(e){return(
                          <FibaRow key={e.p.id_jugadora} entry={e}
                            onApply={function(){applyFibaBatch([e]);}}
                            onPlaceholder={function(){applyPlaceholderToEntries([e]);}}
                            showActions={true}/>
                        );})
                      }
                    </div>
                  )}
                  {fibaSubTab==="bajos"&&(
                    <div>
                      {fibaResults.bajos.length===0?
                        <div style={{textAlign:"center",padding:"30px 0",color: "var(--fx-muted2)"}}>✅ Todas tienen algún match.</div>:
                        <>
                          <div style={{display:"flex",gap:"8px",marginBottom:"14px",alignItems:"center",flexWrap:"wrap"}}>
                            <button onClick={function(){
                                if(fibaConfirmKey==="bajos_ph"){applyPlaceholderToEntries(fibaResults.bajos);}
                                else{setFibaConfirmKey("bajos_ph");}
                              }} disabled={fibaApplying}
                              style={{background:fibaApplying?"#cbd5e1":(fibaConfirmKey==="bajos_ph"?"#dc2626":"#64748b"),color:"#fff",border:"none",borderRadius:"10px",padding:"10px 16px",fontWeight:700,fontSize:"13px",cursor:fibaApplying?"default":"pointer"}}>
                              {fibaApplying?"Aplicando…":(fibaConfirmKey==="bajos_ph"?`⚠️ Pulsa otra vez para confirmar (${fibaResults.bajos.length})`:`👤 Poner placeholder a todas (${fibaResults.bajos.length})`)}
                            </button>
                            {fibaConfirmKey==="bajos_ph"&&!fibaApplying&&<button onClick={function(){setFibaConfirmKey(null);}} style={{background:"transparent",color: "var(--fx-muted2)",border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"10px 14px",cursor:"pointer",fontSize:"12px"}}>Cancelar</button>}
                            <span style={{fontSize:"11px",color: "var(--fx-muted2)"}}>Marca todas las jugadoras sin match con el placeholder oficial (empty-face). Reversible desde "↩ Revertir último lote".</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {fibaResults.bajos.map(function(e){return(
                              <div key={e.p.id_jugadora} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)"}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:700,fontSize:"13px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.p.nombre}</div>
                                  <div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>{e.p.nacionalidad} · {e.p.fecha_nac}</div>
                                </div>
                                <button onClick={function(){applyPlaceholderToEntries([e]);}} disabled={fibaApplying}
                                  style={{background:"#64748b",color:"#fff",border:"none",borderRadius:"8px",padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:fibaApplying?"default":"pointer"}}>
                                  👤 Placeholder
                                </button>
                                <a href={`https://www.fiba.basketball/en/search?text=${encodeURIComponent(e.p.nombre)}`} target="_blank" rel="noopener noreferrer"
                                  style={{background:"#2563eb",color:"#fff",padding:"6px 10px",borderRadius:"8px",textDecoration:"none",fontSize:"11px",fontWeight:700}}>
                                  Buscar ↗
                                </a>
                              </div>
                            );})}
                          </div>
                        </>
                      }
                    </div>
                  )}
                  {fibaApplyRes&&(
                    <div style={{marginTop:"14px",padding:"12px",background:fibaApplyRes.error?"var(--fx-red-bg)":"var(--fx-green-bg)",borderRadius:"10px",border:"1px solid "+(fibaApplyRes.error?"var(--fx-red-border)":"#bbf7d0"),fontSize:"13px"}}>
                      {fibaApplyRes.error?<>❌ {fibaApplyRes.error}</>:<>✅ Aplicadas: <b>{fibaApplyRes.ok}</b> · Errores: <b>{fibaApplyRes.err}</b> · Lote: <code style={{fontSize:"10px"}}>{fibaApplyRes.batchId?.slice(0,8)}…</code></>}
                    </div>
                  )}
                  {fibaResults.errores?.length>0&&(
                    <details style={{marginTop:"12px"}}>
                      <summary style={{fontSize:"12px",color: "var(--fx-muted2)",cursor:"pointer"}}>⚠️ Errores durante el escaneo ({fibaResults.errores.length})</summary>
                      <div style={{maxHeight:"120px",overflowY:"auto",fontSize:"11px",color: "var(--fx-muted)",marginTop:"4px"}}>
                        {fibaResults.errores.map(function(er,i){return <div key={i}>{er.p.nombre}: {er.err}</div>;})}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
                    {tab==="incompletas"&&(
            <div>
              <div style={{display:"flex",gap:"4px",marginBottom:"14px"}}>
                {[["jugadoras","👩‍🏀 Jugadoras"],["equipos","🏟️ Equipos"],["ligas","🏆 Ligas"],["coaches","📋 Cuerpo técnico"]].map(function(st){return(
                  <button key={st[0]} onClick={function(){setSubTab(st[0]);setIssueFilter("");}}
                    style={{flex:1,background:subTab===st[0]?"#9333ea":"#f1f5f9",color:subTab===st[0]?"#fff":"#475569",border:"none",borderRadius:"8px",padding:"7px 4px",cursor:"pointer",fontSize:"11px",fontWeight:700}}>
                    {st[1]}{incompletas[st[0]].length>0&&<span style={{display:"inline-block",marginLeft:"4px",background:subTab===st[0]?"rgba(255,255,255,0.3)":"#ef4444",color:subTab===st[0]?"#fff":"#fff",borderRadius:"10px",padding:"0 5px",fontSize:"10px"}}>{incompletas[st[0]].length}</span>}
                  </button>
                );})}
              </div>
              {(function(){
                var allIssues={};
                incompletas[subTab].forEach(function(item){item.issues.forEach(function(iss){allIssues[iss]=(allIssues[iss]||0)+1;});});
                var issueKeys=Object.keys(allIssues).sort(function(a,b){return allIssues[b]-allIssues[a];});
                if(!issueKeys.length)return null;
                return(
                  <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
                    <button onClick={function(){setIssueFilter("");}}
                      style={{background:issueFilter===""?"#9333ea":"var(--fx-hover)",color:issueFilter===""?"#fff":"#64748b",border:"1px solid "+(issueFilter===""?"#9333ea":"var(--fx-border)"),borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>
                      Todos ({incompletas[subTab].length})
                    </button>
                    {issueKeys.map(function(iss){return(
                      <button key={iss} onClick={function(){setIssueFilter(iss);}}
                        style={{background:issueFilter===iss?"#9333ea":"var(--fx-hover)",color:issueFilter===iss?"#fff":"#64748b",border:"1px solid "+(issueFilter===iss?"#9333ea":"var(--fx-border)"),borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>
                        {iss} ({allIssues[iss]})
                      </button>
                    );})}
                  </div>
                );
              })()}
              {(function(){
                var list=issueFilter?incompletas[subTab].filter(function(item){return item.issues.indexOf(issueFilter)>=0;}):incompletas[subTab];
                return list.length===0?
                <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>{issueFilter?"No hay coincidencias para este filtro":"Todas las fichas completas"}</p></div>:
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {list.map(function(item){
                    var icon={jugadoras:"👩‍🏀",equipos:"🏟️",ligas:"🏆",coaches:"📋"}[item.tipo];
                    return(
                    <div key={item.tipo+item.id} onClick={function(){item.onGo&&item.onGo(item.id);onClose();}}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)",cursor:"pointer",gap:"10px"}}
                      onMouseEnter={function(e){e.currentTarget.style.background="var(--fx-amber-bg)";}}
                      onMouseLeave={function(e){e.currentTarget.style.background="var(--fx-hover)";}}>
                      <div style={{display:"flex",alignItems:"center",gap:"10px",minWidth:0}}>
                        <span style={{fontSize:"16px",flexShrink:0}}>{icon}</span>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.nombre}</div>
                          <div style={{fontSize:"11px",color: "var(--fx-muted2)",fontFamily:"monospace"}}>{item.id}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap",justifyContent:"flex-end",maxWidth:"50%",flexShrink:0}}>
                        {item.issues.map(function(iss){return <span key={iss} style={{background:"var(--fx-red-bg)",color:"#ef4444",borderRadius:"8px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>{iss}</span>;})}
                      </div>
                    </div>
                  );})}
                </div>;
              })()}
            </div>
          )}
          {tab==="duplicadas"&&((duplicadas||[]).length===0?
            <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>No hay temporadas duplicadas</p></div>:
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {(duplicadas||[]).map(function(group,i){
                var sorted=[].concat(group).sort(function(a,b){return a.id-b.id;});
                var fkey=group[0].id_jugadora+group[0].temporada;
                return(
                <div key={i} style={{border:"1.5px solid #fed7aa",borderRadius:"12px",overflow:"hidden"}}>
                  <div style={{background:"var(--fx-amber-bg)",padding:"8px 14px",fontSize:"12px",fontWeight:700,color:"var(--fx-amber-text)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span>{group[0].nombre} — {group[0].temporada}</span>
                    <button onClick={function(){fixDuplicate(group);}} disabled={fixing===fkey}
                      style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>
                      {fixing===fkey?"Corrigiendo...":"✓ Mantener más antigua"}
                    </button>
                  </div>
                  {sorted.map(function(s,j){return(
                    <div key={j} style={{padding:"8px 14px",fontSize:"12px",borderTop:j>0?"1px solid #f8fafc":"none",fontFamily:"monospace",color:j===0?"#16a34a":"#ef4444",display:"flex",gap:"8px"}}>
                      <span style={{fontWeight:j===0?700:400}}>{j===0?"✓ Conservar":"✗ Borrar"}</span>
                      <span>ID {s.id} · equipo: {s.id_equipo} · liga: {s.id_liga}</span>
                    </div>
                  );})}
                </div>
                );
              })}
            </div>
          )}
          {tab==="duplicados_nombre"&&(
            <div>
              {!dupCheckInfo.checked&&!dupCheckInfo.checking&&(
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:"36px",marginBottom:"10px"}}>🔍</div>
                  <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>Busca jugadoras, equipos, ligas y técnicos con nombres parecidos que puedan estar duplicados.</p>
                  <button onClick={checkNameDupes} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 20px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>Buscar duplicados</button>
                </div>
              )}
              {dupCheckInfo.checking&&(
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:"36px",marginBottom:"10px"}}>⏳</div>
                  <p style={{color: "var(--fx-muted)",fontSize:"13px"}}>Analizando nombres…</p>
                </div>
              )}
              {dupCheckInfo.checked&&!dupCheckInfo.checking&&(
                totalNameDupes===0?
                <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>No se han detectado posibles duplicados</p></div>:
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                    <p style={{color: "var(--fx-muted)",fontSize:"13px",margin:0}}>{totalNameDupes} grupo{totalNameDupes!==1?"s":""} sospechoso{totalNameDupes!==1?"s":""}</p>
                    <button onClick={checkNameDupes} style={{background: "var(--fx-card)",color:"#9333ea",border:"1.5px solid #9333ea",borderRadius:"8px",padding:"5px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>↻ Repetir</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                    {["jugadoras","equipos","ligas","coaches"].map(function(tipo){
                      var icon={jugadoras:"👩‍🏀",equipos:"🏟️",ligas:"🏆",coaches:"📋"}[tipo];
                      var idKeyMap={jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"};
                      var onGoMap={jugadoras:onGoToPlayer,equipos:onGoToTeam,ligas:onGoToLeague,coaches:onGoToCoach};
                      var groups=nameDupes[tipo];
                      if(!groups.length)return null;
                      return groups.map(function(group,gi){return(
                        <div key={tipo+gi} style={{border:"1.5px solid #fed7aa",borderRadius:"14px",overflow:"hidden"}}>
                          <div style={{background:"var(--fx-amber-bg)",padding:"8px 14px",fontSize:"12px",fontWeight:700,color:"var(--fx-amber-text)",borderBottom:"1px solid #fed7aa",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span>{icon} {group.items.length} coincidencias</span>
                            <div style={{display:"flex",gap:"4px"}}>
                              {isAdmin&&tipo==="jugadoras"&&<button onClick={function(){setMergeTarget({tipo:tipo,items:group.items,keepIdx:null});}} title="Fusionar registros"
                                style={{background:"var(--fx-blue-bg)",border:"1.5px solid #93c5fd",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,color:"#2563eb",cursor:"pointer"}}>
                                🔗 Fusionar
                              </button>}
                              {isAdmin&&tipo==="equipos"&&<button onClick={function(){setMergeTarget({tipo:tipo,items:group.items,keepIdx:null});}} title="Fusionar registros"
                                style={{background:"var(--fx-blue-bg)",border:"1.5px solid #93c5fd",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,color:"#2563eb",cursor:"pointer"}}>
                                🔗 Fusionar
                              </button>}
                              <button onClick={function(){ignoreGroup(tipo,group);}} title="Marcar como falso positivo"
                                style={{background: "var(--fx-card)",border:"1.5px solid #cbd5e1",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,color: "var(--fx-muted)",cursor:"pointer"}}>
                                ✓ No es duplicado
                              </button>
                            </div>
                          </div>
                          {group.items.map(function(it,ii){
                            var seasons=tipo==="jugadoras"?(it.seasons||[]):null;
                            var lastSeason=seasons&&seasons.length?[...seasons].sort(function(a,b){return b.temporada.localeCompare(a.temporada);})[0]:null;
                            var eqNombre=lastSeason?(equipos.find(function(e){return e.id_equipo===lastSeason.id_equipo;})||{}).nombre:null;
                            return(
                            <div key={ii} style={{padding:"12px 14px",borderBottom:ii<group.items.length-1?"1px solid #f8fafc":"none"}}>
                              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                                <div onClick={function(){onGoMap[tipo]&&onGoMap[tipo](it[idKeyMap[tipo]]);onClose();}} style={{cursor:"pointer",flex:1,minWidth:0}}>
                                  <div style={{fontSize:"14px",fontWeight:700,color: "var(--fx-text)"}}>{it.nombre} <span style={{fontSize:"11px",color:"#9333ea",fontWeight:700}}>Ver →</span></div>
                                  <div style={{fontSize:"11px",color: "var(--fx-muted2)",fontFamily:"monospace",marginTop:"2px"}}>{it[idKeyMap[tipo]]}</div>
                                  {tipo==="jugadoras"&&(
                                    <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginTop:"6px",fontSize:"12px",color: "var(--fx-label)"}}>
                                      {it.posicion&&<span>🏀 {it.posicion}</span>}
                                      {it.altura_cm&&<span>📏 {it.altura_cm} cm</span>}
                                      {it.fecha_nac&&<span>🎂 {it.fecha_nac}</span>}
                                      {it.nacionalidad&&<span>🌍 {it.nacionalidad}</span>}
                                    </div>
                                  )}
                                  {tipo==="jugadoras"&&(
                                    <div style={{fontSize:"12px",color: "var(--fx-muted)",marginTop:"4px"}}>
                                      {seasons?seasons.length:0} temporada{seasons&&seasons.length!==1?"s":""}{lastSeason?" · última: "+lastSeason.temporada+(eqNombre?" en "+eqNombre:""):""}
                                    </div>
                                  )}
                                  {(tipo==="equipos"||tipo==="ligas")&&(it.pais||it.ciudad)&&(
                                    <div style={{fontSize:"12px",color: "var(--fx-muted)",marginTop:"4px"}}>{it.pais}{it.ciudad?" · "+it.ciudad:""}</div>
                                  )}
                                  {tipo==="coaches"&&(it.nacionalidad||it.fecha_nac)&&(
                                    <div style={{fontSize:"12px",color: "var(--fx-muted)",marginTop:"4px"}}>{it.nacionalidad}{it.fecha_nac?" · "+it.fecha_nac:""}</div>
                                  )}
                                </div>
                                {isAdmin&&<button onClick={function(){setDupDelTarget({tipo:tipo,id:it[idKeyMap[tipo]],nombre:it.nombre});}} title="Eliminar esta ficha"
                                  style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"8px",padding:"5px 9px",fontSize:"12px",cursor:"pointer",color:"#ef4444",flexShrink:0}}>🗑️</button>}
                              </div>
                            </div>
                          );})}
                        </div>
                      );});
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {mergeTarget&&(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={e=>{if(e.target===e.currentTarget)setMergeTarget(null);}}>
              <div style={{background: "var(--fx-card)",borderRadius:"16px",padding:"24px",maxWidth:"400px",width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
                <h3 style={{fontWeight:800,fontSize:"16px",color: "var(--fx-text)",margin:"0 0 8px"}}>🔗 Fusionar registros</h3>
                <p style={{fontSize:"13px",color: "var(--fx-muted)",margin:"0 0 16px"}}>Elige cuál conservar. Los datos del otro se moverán a este y se eliminará el duplicado.</p>
                <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"16px"}}>
                  {mergeTarget.items.map(function(it,i){
                    var idKey={jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"}[mergeTarget.tipo];
                    var selected=mergeTarget.keepIdx===i;
                    var seasons=it.seasons||[];
                    return(
                      <div key={i} onClick={function(){setMergeTarget(Object.assign({},mergeTarget,{keepIdx:i}));}}
                        style={{border:selected?"2px solid #9333ea":"1.5px solid var(--fx-border)",borderRadius:"12px",padding:"12px",cursor:"pointer",background:selected?"var(--fx-lila-bg)":"#fff"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)"}}>{it.nombre}</div>
                            <div style={{fontSize:"11px",color: "var(--fx-muted2)",fontFamily:"monospace"}}>{it[idKey]}</div>
                          </div>
                          {selected&&<span style={{background:"#9333ea",color:"#fff",fontSize:"10px",fontWeight:800,padding:"2px 8px",borderRadius:"10px"}}>CONSERVAR</span>}
                        </div>
                        {mergeTarget.tipo==="jugadoras"&&<div style={{fontSize:"11px",color: "var(--fx-muted)",marginTop:"4px"}}>
                          {it.posicion&&<span>{it.posicion} · </span>}
                          {it.nacionalidad&&<span>{it.nacionalidad} · </span>}
                          {seasons.length} temporada{seasons.length!==1?"s":""}
                          {it.id_ext&&<span> · ext:{it.id_ext}</span>}
                        </div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={function(){setMergeTarget(null);}} style={{flex:1,background: "var(--fx-hover)",border:"none",borderRadius:"10px",padding:"10px",fontWeight:700,fontSize:"13px",cursor:"pointer",color: "var(--fx-muted)"}}>Cancelar</button>
                  <button onClick={doMerge} disabled={mergeTarget.keepIdx==null||merging}
                    style={{flex:1,background:mergeTarget.keepIdx!=null?"#2563eb":"#cbd5e1",color:"#fff",border:"none",borderRadius:"10px",padding:"10px",fontWeight:700,fontSize:"13px",cursor:mergeTarget.keepIdx!=null?"pointer":"not-allowed",opacity:merging?0.5:1}}>
                    {merging?"Fusionando...":"Fusionar"}
                  </button>
                </div>
              </div>
            </div>
          )}
                    {tab==="huecos"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {Object.entries(huecos||{}).map(function(entry){
                var tabla=entry[0];var info=entry[1];
                return(
                <div key={tabla} style={{background: "var(--fx-hover)",borderRadius:"12px",padding:"14px",border:"1px solid var(--fx-border)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                    <span style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",textTransform:"capitalize"}}>{tabla.replace("_"," ")}</span>
                    <span style={{background:info.total>0?"var(--fx-blue-bg)":"var(--fx-green-bg)",color:info.total>0?"var(--fx-blue-text)":"#16a34a",borderRadius:"8px",padding:"2px 10px",fontSize:"12px",fontWeight:700}}>
                      {info.total>0?info.total+" huecos":"Sin huecos"}
                    </span>
                  </div>
                  <div style={{fontSize:"13px",color: "var(--fx-label)"}}>Próximo ID libre: <b style={{color:"#9333ea"}}>{info.nextFree}</b></div>
                  {info.gaps.length>0&&<div style={{marginTop:"6px",fontSize:"11px",color: "var(--fx-muted2)"}}>Huecos: {info.gaps.join(", ")}{info.total>15?" …":""}</div>}
                  <div style={{marginTop:"4px",fontSize:"11px",color: "var(--fx-muted2)"}}>Siguiente al más alto: <b style={{color: "var(--fx-muted)"}}>{info.nextAfterMax}</b></div>
                </div>
                );
              })}
            </div>
          )}
          {tab==="escudos_rotos"&&(
            <div>
              {!brokenInfo.checked&&!brokenInfo.checking&&(
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:"36px",marginBottom:"10px"}}>🖼️</div>
                  <p style={{color: "var(--fx-muted)",fontSize:"13px",marginBottom:"14px"}}>Comprueba si los escudos de equipos y ligas cargan correctamente desde tu navegador.</p>
                  <button onClick={checkBrokenEscudos} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 20px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>Comprobar escudos</button>
                </div>
              )}
              {brokenInfo.checking&&(
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:"36px",marginBottom:"10px"}}>⏳</div>
                  <p style={{color: "var(--fx-muted)",fontSize:"13px"}}>Comprobando {brokenInfo.progress} de {brokenInfo.total}…</p>
                  <div style={{width:"100%",maxWidth:"260px",height:"6px",background:"var(--fx-border)",borderRadius:"4px",margin:"10px auto 0",overflow:"hidden"}}>
                    <div style={{height:"100%",background:"#9333ea",width:(brokenInfo.total?Math.round(brokenInfo.progress/brokenInfo.total*100):0)+"%",transition:"width 0.2s"}}/>
                  </div>
                </div>
              )}
              {brokenInfo.checked&&!brokenInfo.checking&&(
                brokenInfo.broken.length===0?
                <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>Todos los escudos cargan correctamente ({brokenInfo.total} comprobados)</p></div>:
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                    <p style={{color: "var(--fx-muted)",fontSize:"13px",margin:0}}>{brokenInfo.broken.length} de {brokenInfo.total} escudos rotos</p>
                    <button onClick={checkBrokenEscudos} style={{background: "var(--fx-card)",color:"#9333ea",border:"1.5px solid #9333ea",borderRadius:"8px",padding:"5px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>↻ Repetir</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {brokenInfo.broken.map(function(item){
                      var icon=item.tipo==="equipos"?"🏟️":"🏆";
                      return(
                      <div key={item.tipo+item.id} onClick={function(){item.onGo&&item.onGo(item.id);onClose();}}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)",cursor:"pointer",gap:"10px"}}
                        onMouseEnter={function(e){e.currentTarget.style.background="var(--fx-amber-bg)";}}
                        onMouseLeave={function(e){e.currentTarget.style.background="var(--fx-hover)";}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",minWidth:0}}>
                          <span style={{fontSize:"16px",flexShrink:0}}>{icon}</span>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.nombre}</div>
                            <div style={{fontSize:"10px",color: "var(--fx-muted2)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"260px"}}>{item.url}</div>
                          </div>
                        </div>
                        <span style={{background:"var(--fx-red-bg)",color:"#ef4444",borderRadius:"8px",padding:"2px 8px",fontSize:"10px",fontWeight:700,flexShrink:0}}>Roto</span>
                      </div>
                    );})}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="nacionalidades"&&(
            <div>
              {nacInfo.sinBandera.length===0&&nacInfo.variantes.length===0&&nacInfo.nacDup.length===0?(
                <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>Todas las nacionalidades tienen bandera y no hay duplicados</p></div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
                  <div>
                    <h3 style={{fontWeight:800,fontSize:"13px",color: "var(--fx-text)",margin:"0 0 8px"}}>🏳️ Países sin bandera ({nacInfo.sinBandera.length})</h3>
                    {nacInfo.sinBandera.length===0?<p style={{color: "var(--fx-muted2)",fontSize:"12px",margin:0}}>Ninguno.</p>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {nacInfo.sinBandera.map(function(item){return(
                          <div key={item.valor} style={{padding:"10px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                              <span style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)"}}>"{item.valor}"</span>
                              <span style={{background:"var(--fx-red-bg)",color:"#ef4444",borderRadius:"8px",padding:"2px 8px",fontSize:"10px",fontWeight:700,flexShrink:0}}>{item.count} jugadora{item.count!==1?"s":""}</span>
                            </div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"6px"}}>
                              {item.players.map(function(p){return(
                                <button key={p.id_jugadora} onClick={function(){onGoToPlayer&&onGoToPlayer(p.id_jugadora);onClose();}}
                                  style={{background: "var(--fx-card)",color:"#9333ea",border:"1px solid #e9d5ff",borderRadius:"8px",padding:"3px 8px",fontSize:"11px",fontWeight:600,cursor:"pointer"}}>{p.nombre}</button>
                              );})}
                              {item.count>item.players.length&&<span style={{fontSize:"11px",color: "var(--fx-muted2)",alignSelf:"center"}}>+{item.count-item.players.length} más</span>}
                            </div>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{fontWeight:800,fontSize:"13px",color: "var(--fx-text)",margin:"0 0 8px"}}>🔀 Variantes del mismo país ({nacInfo.variantes.length})</h3>
                    <p style={{color: "var(--fx-muted2)",fontSize:"11px",margin:"0 0 8px"}}>Distintas grafías en la base de datos que resuelven a la misma bandera. Ojo: algunas son intencionadas (p. ej. "Islas Vírgenes de EE.UU.").</p>
                    {nacInfo.variantes.length===0?<p style={{color: "var(--fx-muted2)",fontSize:"12px",margin:0}}>Ninguna.</p>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {nacInfo.variantes.map(function(item){
                          var mayor=item.variantes[0];
                          var minor=item.variantes.slice(1);
                          var totalMin=minor.reduce(function(a,v){return a+v.count;},0);
                          return(
                          <div key={item.code} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)"}}>
                            <span style={{fontSize:"18px",flexShrink:0}}>{flagEmoji(item.code)}</span>
                            <div style={{fontSize:"13px",color: "var(--fx-text)",minWidth:0,flex:1}}>
                              {item.variantes.map(function(v,i){return(
                                <span key={v.valor}>{i>0&&<span style={{color:"#cbd5e1"}}> · </span>}<b>"{v.valor}"</b> <span style={{color: "var(--fx-muted2)",fontSize:"11px"}}>({v.count})</span></span>
                              );})}
                            </div>
                            {isAdmin&&(
                              <button
                                disabled={nacFixing===item.code}
                                onClick={async function(){
                                  var minorLabels=minor.map(function(v){return '"'+v.valor+'" ('+v.count+')';}).join(", ");
                                  var msg=totalMin+" jugadora"+(totalMin===1?"":"s")+" pasarán de "+minorLabels+' a "'+mayor.valor+'". ¿Confirmar?';
                                  if(!window.confirm(msg))return;
                                  setNacFixing(item.code);
                                  try{
                                    var valores=minor.map(function(v){return v.valor;});
                                    var r1=await supabase.from("jugadoras").update({nacionalidad:mayor.valor}).in("nacionalidad",valores);
                                    var r2=await supabase.from("jugadoras").update({nacionalidad2:mayor.valor}).in("nacionalidad2",valores);
                                    if(r1.error||r2.error){window.alert("Error: "+((r1.error||r2.error).message||"desconocido"));return;}
                                    setPlayers(function(prev){return prev.map(function(p){
                                      var np=Object.assign({},p);
                                      if(valores.indexOf(p.nacionalidad)>=0)np.nacionalidad=mayor.valor;
                                      if(valores.indexOf(p.nacionalidad2)>=0)np.nacionalidad2=mayor.valor;
                                      return np;
                                    });});
                                  }finally{setNacFixing(null);}
                                }}
                                title={'Cambiar todas las variantes minoritarias a "'+mayor.valor+'"'}
                                style={{flexShrink:0,background:nacFixing===item.code?"var(--fx-hover)":"#9333ea",color:nacFixing===item.code?"var(--fx-muted)":"#fff",border:"none",borderRadius:"8px",padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:nacFixing===item.code?"wait":"pointer"}}>
                                {nacFixing===item.code?"…":"→ Normalizar"}
                              </button>
                            )}
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{fontWeight:800,fontSize:"13px",color: "var(--fx-text)",margin:"0 0 8px"}}>👯 Jugadoras con nacionalidad repetida ({nacInfo.nacDup.length})</h3>
                    {nacInfo.nacDup.length===0?<p style={{color: "var(--fx-muted2)",fontSize:"12px",margin:0}}>Ninguna.</p>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {nacInfo.nacDup.map(function(p){return(
                          <div key={p.id_jugadora} onClick={function(){onGoToPlayer&&onGoToPlayer(p.id_jugadora);onClose();}}
                            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)",cursor:"pointer",gap:"10px"}}
                            onMouseEnter={function(e){e.currentTarget.style.background="var(--fx-amber-bg)";}}
                            onMouseLeave={function(e){e.currentTarget.style.background="var(--fx-hover)";}}>
                            <span style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nombre}</span>
                            <span style={{fontSize:"11px",color: "var(--fx-muted2)",flexShrink:0}}>"{p.nacionalidad}" + "{p.nacionalidad2}"</span>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="fotos"&&(
            (fotosPlaceholder.jug.length+fotosPlaceholder.tec.length)===0?
            <div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)"}}><div style={{fontSize:"36px"}}>✅</div><p>Ninguna ficha usa la foto por defecto</p></div>:
            <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              <p style={{fontSize:"12px",color: "var(--fx-muted2)",margin:0}}>Fichas cuya foto sigue siendo la silueta por defecto. Pulsa para abrir la ficha y cambiarla.</p>
              {fotosPlaceholder.jug.length>0&&(
                <div>
                  <h3 style={{fontWeight:800,fontSize:"13px",color: "var(--fx-text)",margin:"0 0 8px"}}>👩‍🏀 Jugadoras ({fotosPlaceholder.jug.length})</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {fotosPlaceholder.jug.map(function(p){return(
                      <div key={p.id_jugadora} onClick={function(){onGoToPlayer&&onGoToPlayer(p.id_jugadora);onClose();}}
                        style={{display:"flex",alignItems:"center",gap:"12px",padding:"8px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)",cursor:"pointer"}}
                        onMouseEnter={function(e){e.currentTarget.style.background="var(--fx-amber-bg)";}}
                        onMouseLeave={function(e){e.currentTarget.style.background="var(--fx-hover)";}}>
                        <img loading="lazy" decoding="async" src={p.foto} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",flexShrink:0,background:"var(--fx-border)"}}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nombre}</div>
                          <div style={{fontSize:"11px",color: "var(--fx-muted2)",fontFamily:"monospace"}}>{p.id_jugadora}</div>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              )}
              {fotosPlaceholder.tec.length>0&&(
                <div>
                  <h3 style={{fontWeight:800,fontSize:"13px",color: "var(--fx-text)",margin:"0 0 8px"}}>📋 Cuerpo técnico ({fotosPlaceholder.tec.length})</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {fotosPlaceholder.tec.map(function(c){return(
                      <div key={c.id_coach} onClick={function(){onGoToCoach&&onGoToCoach(c.id_coach);onClose();}}
                        style={{display:"flex",alignItems:"center",gap:"12px",padding:"8px 14px",background: "var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)",cursor:"pointer"}}
                        onMouseEnter={function(e){e.currentTarget.style.background="var(--fx-amber-bg)";}}
                        onMouseLeave={function(e){e.currentTarget.style.background="var(--fx-hover)";}}>
                        <img loading="lazy" decoding="async" src={c.foto} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",flexShrink:0,background:"var(--fx-border)"}}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color: "var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nombre}</div>
                          <div style={{fontSize:"11px",color: "var(--fx-muted2)",fontFamily:"monospace"}}>{c.id_coach}</div>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="estado"&&(function(){
            var d=estadoData;
            function fmtDate(v){if(!v)return"—";var dt=new Date(typeof v==="number"?(v<1e12?v*1000:v):v);return dt.toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
            function fmtSize(b){if(!b)return"—";if(b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";if(b<1073741824)return(b/1048576).toFixed(1)+" MB";return(b/1073741824).toFixed(2)+" GB";}
            function since(v){if(!v)return"";var dt=new Date(typeof v==="number"?(v<1e12?v*1000:v):v);var s=(Date.now()-dt.getTime())/1000;if(s<60)return"hace "+Math.round(s)+"s";if(s<3600)return"hace "+Math.round(s/60)+" min";if(s<86400)return"hace "+Math.round(s/3600)+" h";return"hace "+Math.round(s/86400)+" d";}
            var card={background: "var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"14px",padding:"14px"};
            var h={fontWeight:800,fontSize:"12px",color: "var(--fx-text)",margin:"0 0 10px",display:"flex",alignItems:"center",justifyContent:"space-between"};
            var kv={fontSize:"12px",color: "var(--fx-label)",display:"flex",justifyContent:"space-between",padding:"3px 0"};
            var dot=function(c){return{display:"inline-block",width:8,height:8,borderRadius:"50%",background:c,marginRight:6};};
            function pill(txt,color){return<span style={{background:color+"20",color:color,fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"10px"}}>{txt}</span>;}
            function block(title,body,link){return(
              <div style={card}>
                <div style={h}><span>{title}</span>{link&&<a href={link} target="_blank" rel="noopener" style={{fontSize:"10px",color:"#9333ea",textDecoration:"none",fontWeight:700}}>abrir ↗</a>}</div>
                {body}
              </div>
            );}
            return(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                  <p style={{color: "var(--fx-muted)",fontSize:"12px",margin:0}}>Uptime, cron pings, backup en Backblaze, deploys y visitas. {d&&<span style={{color: "var(--fx-muted2)"}}>· actualizado {fmtDate(d.ts)}</span>}</p>
                  <button onClick={cargarEstado} disabled={estadoBusy} style={{background:estadoBusy?"#cbd5e1":"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"12px",cursor:estadoBusy?"default":"pointer"}}>{estadoBusy?"⏳ Cargando…":"🔄 Refrescar"}</button>
                </div>
                {estadoErr&&<div style={{color:"#dc2626",fontSize:"12px",marginBottom:"10px"}}>❌ {estadoErr}</div>}
                {!d&&!estadoBusy&&<div style={{textAlign:"center",padding:"40px 0",color: "var(--fx-muted2)",fontSize:"13px"}}>Pulsa <b>Refrescar</b> para consultar el estado.</div>}
                {d&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                    {/* Uptime */}
                    {block("🌐 Uptime",d.uptime.error?<div style={{color:"#dc2626",fontSize:"11px"}}>{d.uptime.error}</div>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                        {(d.uptime.monitors||[]).map(function(m,i){var up=m.status===2;return(
                          <div key={i}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                              <div style={{fontSize:"12px",fontWeight:700,color: "var(--fx-text)"}}><span style={dot(up?"#22c55e":"#ef4444")}/>{m.name}</div>
                              {pill(up?"UP":"DOWN",up?"#22c55e":"#ef4444")}
                            </div>
                            <div style={kv}><span>24h · 7d · 30d</span><span style={{fontFamily:"monospace"}}>{(m.uptime||[]).map(function(x){return(parseFloat(x)||0).toFixed(2);}).join(" · ")}%</span></div>
                            {m.response_ms&&<div style={kv}><span>Respuesta</span><span>{m.response_ms} ms</span></div>}
                            {m.last_log&&<div style={{fontSize:"10px",color: "var(--fx-muted2)",marginTop:"4px"}}>Último evento: {m.last_log.type===2?"UP":"DOWN"} · {fmtDate(m.last_log.datetime)}{m.last_log.reason?" · "+m.last_log.reason:""}</div>}
                          </div>
                        );})}
                        {!(d.uptime.monitors||[]).length&&<div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>Sin monitors</div>}
                      </div>
                    ),"https://dashboard.uptimerobot.com/")}
                    {/* Cron */}
                    {block("⏰ Cron pings",d.cron.error?<div style={{color:"#dc2626",fontSize:"11px"}}>{d.cron.error}</div>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {(d.cron.checks||[]).map(function(c,i){
                          var col=c.status==="up"?"#22c55e":c.status==="late"?"#f59e0b":c.status==="down"?"#ef4444":"#94a3b8";
                          return(
                            <div key={i}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div style={{fontSize:"12px",fontWeight:700,color: "var(--fx-text)"}}><span style={dot(col)}/>{c.name}</div>
                                {pill(c.status.toUpperCase(),col)}
                              </div>
                              <div style={{fontSize:"10px",color: "var(--fx-muted2)",marginLeft:"14px"}}>Últ. ping {since(c.last_ping)} · {c.schedule}</div>
                            </div>
                          );
                        })}
                        {!(d.cron.checks||[]).length&&<div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>Sin checks</div>}
                      </div>
                    ),"https://healthchecks.io/checks/")}
                    {/* Backup */}
                    {block("💾 Backup (Backblaze B2)",d.backup.error?<div style={{color:"#dc2626",fontSize:"11px"}}>{d.backup.error}</div>:(function(){
                      var last=d.backup.last;var stale=last?(Date.now()-last.ts)/86400000>8:true;
                      return(
                        <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                            <div style={{fontSize:"12px",fontWeight:700,color: "var(--fx-text)"}}><span style={dot(stale?"#f59e0b":"#22c55e")}/>{last?since(last.ts):"sin backups"}</div>
                            {pill(stale?"REVISAR":"OK",stale?"#f59e0b":"#22c55e")}
                          </div>
                          {last&&<div style={{fontSize:"10px",color: "var(--fx-muted2)",wordBreak:"break-all"}}>{last.name}</div>}
                          <div style={kv}><span>Backups guardados</span><span>{d.backup.total}</span></div>
                          <div style={kv}><span>Tamaño total</span><span>{fmtSize(d.backup.total_size)}</span></div>
                          {last&&<div style={kv}><span>Último tamaño</span><span>{fmtSize(last.size)}</span></div>}
                        </div>
                      );
                    })(),"https://backupdrill.com/console/")}
                    {/* Vercel */}
                    {block("🚀 Vercel",d.vercel.error?<div style={{color:"#dc2626",fontSize:"11px"}}>{d.vercel.error}</div>:(
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {(d.vercel.deploys||[]).slice(0,5).map(function(dep,i){
                          var col=dep.state==="READY"?"#22c55e":dep.state==="ERROR"?"#ef4444":dep.state==="BUILDING"?"#3b82f6":"#94a3b8";
                          return(
                            <div key={i} style={{fontSize:"11px",borderBottom:i<4?"1px solid var(--fx-border2)":"none",paddingBottom:"5px"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <span style={{fontWeight:700,color:col}}>{dep.state}{dep.target==="production"?" ·prod":""}</span>
                                <span style={{color: "var(--fx-muted2)",fontSize:"10px"}}>{fmtDate(dep.created)}</span>
                              </div>
                              {dep.commit&&<div style={{color: "var(--fx-label)",fontSize:"10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dep.commit}</div>}
                            </div>
                          );
                        })}
                        {!(d.vercel.deploys||[]).length&&<div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>Sin deploys</div>}
                      </div>
                    ),"https://vercel.com/dashboard")}
                    {/* Tracking / visitas */}
                    <div style={{...card,gridColumn:"1 / -1"}}>
                      <div style={h}><span>📊 App · visitas</span></div>
                      {d.app.error?<div style={{color:"#dc2626",fontSize:"11px"}}>{d.app.error}</div>:(
                        <div style={{display:"flex",gap:"20px"}}>
                          <div><div style={{fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{d.app.visitas_24h}</div><div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>últimas 24h</div></div>
                          <div><div style={{fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{d.app.visitas_7d}</div><div style={{fontSize:"11px",color: "var(--fx-muted2)"}}>últimos 7 días</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
      {dupDelTarget&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background: "var(--fx-card)",borderRadius:"16px",padding:"24px",maxWidth:"360px",width:"100%"}}>
            <h3 style={{fontWeight:800,fontSize:"16px",color: "var(--fx-text)",margin:"0 0 8px"}}>¿Eliminar ficha?</h3>
            <p style={{fontSize:"13px",color: "var(--fx-muted)",margin:"0 0 18px"}}>
              Se eliminará <b>{dupDelTarget.nombre}</b> ({dupDelTarget.id}) y todas sus temporadas asociadas. Esta acción no se puede deshacer.
            </p>
            <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
              <button onClick={function(){setDupDelTarget(null);}} style={{background: "var(--fx-hover)",color: "var(--fx-label)",border:"none",borderRadius:"8px",padding:"8px 16px",fontWeight:600,cursor:"pointer",fontSize:"13px"}}>Cancelar</button>
              <button onClick={function(){deleteDupItem(dupDelTarget.tipo,dupDelTarget.id);}} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:"13px"}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Presenta el resultado de un scraper con chips coloreados + secciones
   colapsables. Usa <details> nativo, cero JS de estado. */
function ScraperResult({res,busy}){
  if(res.error) return <div style={{marginTop:"16px",background:"var(--fx-red-bg)",border:"1px solid #fecaca",borderRadius:"12px",padding:"14px",color:"var(--fx-red-text)",fontSize:"13px",fontWeight:600}}>❌ {res.error}</div>;
  const dry=!!res.dry;
  const chip=(label,value,color)=>{
    if(!value||value===0)return null;
    return <span key={label} style={{display:"inline-flex",alignItems:"center",gap:"5px",background:color+"22",color,border:"1px solid "+color+"55",borderRadius:"999px",padding:"4px 10px",fontSize:"12px",fontWeight:700}}>{label}: <b>{value}</b></span>;
  };
  const section=(title,items,color,note)=>{
    if(!items||!items.length)return null;
    return (
      <details style={{marginTop:"8px",border:"1px solid "+color+"33",borderRadius:"10px",background:color+"11"}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",fontWeight:700,fontSize:"12px",color,listStyle:"none",display:"flex",alignItems:"center",gap:"6px"}}>
          <span style={{fontSize:"13px"}}>▸</span>{title} <span style={{background:color,color:"#fff",borderRadius:"999px",padding:"1px 8px",fontSize:"10px"}}>{items.length}</span>
        </summary>
        <div style={{padding:"6px 12px 10px"}}>
          {note&&<div style={{fontSize:"11px",color:"var(--fx-muted)",marginBottom:"6px",fontStyle:"italic"}}>{note}</div>}
          <ul style={{margin:0,paddingLeft:"18px",maxHeight:"200px",overflowY:"auto"}}>
            {items.map((d,i)=><li key={i} style={{fontSize:"12px",color:"var(--fx-text)",marginBottom:"2px"}}>{d}</li>)}
          </ul>
        </div>
      </details>
    );
  };
  // Preparar sin_mapear agrupadas por jugadora
  var sinMapearJugs=null;
  if(res.sin_mapear&&res.sin_mapear.length){
    var m={};res.sin_mapear.forEach(function(s){var k=String(s).replace(/^\S+\s+/,"");m[k]=(m[k]||0)+1;});
    sinMapearJugs=Object.keys(m).sort().map(function(k){return k+(m[k]>1?" ("+m[k]+" partidos)":"");});
  }
  return (
    <div style={{marginTop:"16px",background:"var(--fx-hover)",border:"1px solid var(--fx-border)",borderRadius:"12px",padding:"14px"}}>
      {/* Cabecera + estado */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",marginBottom:"10px"}}>
        <span style={{fontSize:"14px",fontWeight:800,color:dry?"#7c3aed":"#16a34a"}}>{dry?"🔎 Prueba (dry-run)":"✅ Aplicado"}</span>
        {res.progreso&&<span style={{fontSize:"11px",color:"var(--fx-muted)"}}>{busy?"⏳ Procesando… ":"Lotes: "}{res.progreso}{dry?" (solo primer lote)":""}</span>}
      </div>
      {/* Chips de counts */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"6px"}}>
        {chip("Partidos",res.partidos,"#0891b2")}
        {chip("Creados",res.creados,"#16a34a")}
        {chip("Notas rellenadas",res.notas_rellenadas,"#16a34a")}
        {chip("Parciales",res.parciales_escritos,"#0891b2")}
        {chip("Filas boxscore",res.filas,"#0891b2")}
        {chip("Hechos",res.hechos,"#7c3aed")}
        {chip("Saltados",res.saltados,"#94a3b8")}
        {chip("Global",res.via_global,"#7c3aed")}
        {chip("Altas plantilla",res.plantilla_altas,"#16a34a")}
        {res.colisiones&&res.colisiones.length>0&&chip("Colisiones",res.colisiones.length,"#dc2626")}
        {res.sin_mapear_equipos&&res.sin_mapear_equipos.length>0&&chip("Equipos sin mapear",res.sin_mapear_equipos.length,"#dc2626")}
        {sinMapearJugs&&chip("Jugadoras sin mapear",sinMapearJugs.length,"var(--fx-amber-text)")}
      </div>
      {res.mensaje&&<div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"6px"}}>{res.mensaje}</div>}
      {/* Secciones colapsables */}
      {section((dry?"🆕 Partidos a crear":"🆕 Partidos creados"),res.creados_detalle,"#16a34a")}
      {section("⚠️ Equipos sin mapear",res.sin_mapear_equipos,"#dc2626","No se creó el partido; revisa el nombre del equipo")}
      {section("⚠️ Colisiones (dos jugadoras del acta apuntan a la misma ficha)",res.colisiones,"#dc2626","Ese partido no se guardó")}
      {section("👤 Jugadoras sin mapear",sinMapearJugs,"var(--fx-amber-text)","Crea o corrige su ficha y vuelve a lanzar")}
      {section("📋 Detalles",res.detalles,"#64748b")}
    </div>
  );
}


// ─── 🔗 Genius Match ───────────────────────────────────────────────
// Herramienta admin: introspecta Genius Sports para descubrir competiciones
// y equipos, y permite vincular cada equipo Genius con uno de la BD (o crear
// nuevo). También detecta duplicados en BD y ofrece fusionarlos.
// Extrae {org, comp_id?, gameId?} de cualquier URL Genius Sports conocida.
// Patrones soportados:
//   fibalivestats.dcd.shared.geniussports.com/u/{ORG}/{gameId}/...
//   hosted.dcd.shared.geniussports.com/{ORG}/en/competition/{CID}/schedule
//   hosted.dcd.shared.geniussports.com/{ORG}/en/schedule
//   fibalivestats.com/webcast/{ORG}/{gameId}
function parseGeniusUrl(url) {
  if (!url) return null;
  const patterns = [
    /geniussports\.com\/([A-Z0-9]{2,10})\/[a-z]{2}\/competition\/(\d+)\/(?:schedule|standings|teams)/i,
    /geniussports\.com\/u\/([A-Z0-9]{2,10})\/(\d+)/i,
    /geniussports\.com\/([A-Z0-9]{2,10})\/[a-z]{2}\/schedule/i,
    /fibalivestats\.com\/webcast\/([A-Z0-9]{2,10})\/(\d+)/i,
  ];
  for (const rx of patterns) {
    const m = rx.exec(url);
    if (m) {
      return {
        org: m[1].toUpperCase(),
        comp_id: /competition\/\d+/.test(url) ? parseInt(m[2], 10) : null,
        gameId: /\/u\/|webcast\//.test(url) ? m[2] : null,
      };
    }
  }
  return null;
}

// Mapa país → códigos de organización Genius conocidos.
// Ampliar según se descubran nuevos (ver documentación Notion 🔗 Genius Match).
// Slugs de organización en hosted.dcd.shared.geniussports.com/{ORG}/en/schedule.
// Verificados con curl al schedule real. OJO: el slug de una fed en el tracker
// fibalivestats /u/{slug}/ NO tiene por qué coincidir con el slug de hosted.
// Ejemplo: Luxemburgo aparece como /u/LUX/... en tracker pero NO tiene endpoint
// hosted conocido (FLB es Líbano, no Luxemburgo).
const PAIS_TO_ORGS = {
  "Dinamarca": ["DAM"],
  "Bélgica": ["BB"],
  "Belgica": ["BB"],
  "Reino Unido": ["WBBL"],
  "Islandia": ["KKI"],
  "Luxemburgo": ["LUX"], // Slug del tracker fibalivestats. hosted.dcd/LUX devuelve 200 vacío — solo hay partidos individuales, no calendario. Ver mensaje explicativo en autodetectar().
};

// Palabras que descartan una competición aunque haya score fuzzy: toda la BD
// es baloncesto femenino, así que Men/Boys/Masculino nunca son candidatas.
const RX_NO_FEMENINO = /\b(men|men's|mens|boys|masculino|masculin|maschile|maschili|herren|homens|homme|hommes|man)\b/i;

// Tokens genéricos que no aportan al fuzzy match de nombres de competición.
const TOKENS_GENERICOS = new Set(["women","womens","womans","femenino","femenina","league","basketball","liga","cup","copa","division","div","premier","the","de","el","la","of","por","and","y","top","1","2","a","b"]);

function tokensLimpios(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(t => t && !TOKENS_GENERICOS.has(t));
}
function scoreLigaVsComp(nombreLiga, nombreComp) {
  const a = new Set(tokensLimpios(nombreLiga));
  const b = new Set(tokensLimpios(nombreComp));
  if (!a.size || !b.size) return 0;
  let inter = 0; a.forEach(t => { if (b.has(t)) inter++; });
  return inter / Math.max(a.size, b.size);
}

function GeniusMatchTab({ ligas, equipos, setEquipos, setLigas }) {
  const [idLiga, setIdLiga] = useState("");
  const [org, setOrg] = useState("");
  const [comps, setComps] = useState(null);
  const [compId, setCompId] = useState("");
  const [equiposGenius, setEquiposGenius] = useState(null);
  const [fedInfo, setFedInfo] = useState("");
  const [compInfo, setCompInfo] = useState("");
  const [urlPegar, setUrlPegar] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [seleccion, setSeleccion] = useState({});
  const [autoCandidatas, setAutoCandidatas] = useState(null); // [{org, fed, comp_id, nombre, score}]
  const [temporadasLiga, setTemporadasLiga] = useState([]); // temporadas con equipos en esta liga
  const [temporada, setTemporada] = useState("");
  const [equiposLigaTemp, setEquiposLigaTemp] = useState(null); // Set<id_equipo> o null (sin filtro)

  const liga = ligas.find(l => l.id_liga === idLiga);
  // Equipos de la liga+temporada elegida. Si aún no hay temporada cargada, cae
  // al conjunto amplio (todos los clubes) para no bloquear la UI antes del fetch.
  const equiposBD = useMemo(() => {
    if (!idLiga) return [];
    const base = equipos.filter(e => e.tipo === "club");
    const filtered = equiposLigaTemp ? base.filter(e => equiposLigaTemp.has(e.id_equipo)) : base;
    return filtered.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [idLiga, equipos, equiposLigaTemp]);

  // Precarga: si la liga elegida ya tiene genius_org/comp_id, precarga los campos
  useEffect(() => {
    if (!liga) return;
    if (liga.genius_org) setOrg(liga.genius_org);
    if (liga.genius_comp_id) setCompId(String(liga.genius_comp_id));
    setComps(null); setEquiposGenius(null); setFedInfo(""); setCompInfo(""); setSeleccion({}); setAutoCandidatas(null);
    setTemporadasLiga([]); setTemporada(""); setEquiposLigaTemp(null);
  }, [idLiga]);

  // Cargar temporadas disponibles para la liga seleccionada
  useEffect(() => {
    if (!idLiga) return;
    (async () => {
      const { data } = await supabase.from("temporadas").select("temporada").eq("id_liga", idLiga);
      const ts = [...new Set((data || []).map(r => r.temporada).filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a)));
      setTemporadasLiga(ts);
      if (ts.length && !temporada) setTemporada(ts[0]); // más reciente por defecto
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idLiga]);

  // Cargar equipos de la liga+temporada elegida
  useEffect(() => {
    if (!idLiga || !temporada) { setEquiposLigaTemp(null); return; }
    (async () => {
      const { data } = await supabase.from("temporadas").select("id_equipo").eq("id_liga", idLiga).eq("temporada", temporada);
      const s = new Set((data || []).map(r => r.id_equipo).filter(Boolean));
      setEquiposLigaTemp(s);
    })();
  }, [idLiga, temporada]);

  // Auto-detección: al elegir liga sin config Genius, prueba los orgs conocidos
  // del país, junta competiciones y ordena por similitud del nombre.
  const autodetectar = async () => {
    if (!liga) return;
    const orgs = PAIS_TO_ORGS[liga.pais] || [];
    if (!orgs.length) {
      setAutoCandidatas([]);
      setMsg(`⚠ Sin orgs Genius conocidos para "${liga.pais}". Usa el pegado de URL o la búsqueda manual.`);
      return;
    }
    setBusy(true); setMsg(""); setAutoCandidatas(null);
    const todas = [];
    const fallos = [];
    for (const o of orgs) {
      try {
        const r = await callFn("genius-inspeccionar", { org: o });
        if (!r?.ok) { fallos.push(`${o}: ${r?.error || "sin datos"}`); continue; }
        (r.competiciones || []).forEach(c => {
          if (RX_NO_FEMENINO.test(c.nombre)) return; // toda la BD es femenina
          todas.push({ org: o, fed: r.fed || o, comp_id: c.comp_id, nombre: c.nombre, score: scoreLigaVsComp(liga.nombre, c.nombre) });
        });
      } catch (e) { fallos.push(`${o}: ${String(e.message || e)}`); }
    }
    todas.sort((a, b) => b.score - a.score);
    // Si el fuzzy no encuentra nada (típico con acrónimos tipo LBBL vs "Women
    // First Division"), muestra igualmente las top competiciones para que el
    // usuario elija a ojo. Mejor que quedarse sin opciones.
    const conMatch = todas.filter(c => c.score >= 0.2);
    const top = conMatch.length ? conMatch.slice(0, 5) : todas.slice(0, 8);
    setAutoCandidatas(top);
    if (!todas.length) {
      setMsg(`⚠ ${orgs.join(",")} no publica calendario en hosted.dcd (solo tracker de partidos individuales por gameId). No podemos autodetectar competición ni cargar calendario para esta liga. ${fallos.join(" · ") || ""}`);
    } else if (!conMatch.length) setMsg(`ℹ Sin match automático para "${liga.nombre}". Elige a mano entre las ${todas.length} de ${orgs.join(",")}.`);
    else setMsg(`✅ ${top.length} candidata${top.length > 1 ? "s" : ""} — elige la correcta`);
    setBusy(false);
  };

  const aplicarCandidata = async (c) => {
    setOrg(c.org); setCompId(String(c.comp_id)); setFedInfo(c.fed);
    setBusy(true); setMsg("");
    try {
      const r = await callFn("genius-inspeccionar", { org: c.org, comp_id: c.comp_id });
      if (!r?.ok) throw new Error(r?.error || "Sin datos");
      setEquiposGenius(r.equipos || []);
      setCompInfo(r.comp || c.nombre);
      preSeleccionar(r.equipos || []);
      setAutoCandidatas(null);
      setMsg(`✅ ${r.equipos?.length || 0} equipos cargados`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const buscarComps = async () => {
    if (!org.trim()) { setMsg("Escribe el código Genius de la federación"); return; }
    setBusy(true); setMsg(""); setComps(null); setEquiposGenius(null);
    try {
      const r = await callFn("genius-inspeccionar", { org });
      if (!r?.ok) throw new Error(r?.error || "Sin datos");
      setComps(r.competiciones || []);
      setFedInfo(r.fed || "");
      setMsg(`✅ ${r.competiciones?.length || 0} competiciones encontradas`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const analizarUrl = async () => {
    const parsed = parseGeniusUrl(urlPegar.trim());
    if (!parsed) {
      setMsg("⚠ URL no reconocida. Formatos válidos: hosted.dcd.shared.geniussports.com/{ORG}/… o fibalivestats.dcd.shared.geniussports.com/u/{ORG}/{gameId}/");
      return;
    }
    // Los slugs de /u/{X}/ en fibalivestats NO son siempre orgs válidos del
    // hosted.dcd.shared (ej: /u/LUX/... viene de Luxemburgo pero su org real es
    // FLBB). Si la liga tiene país con orgs conocidos y solo tenemos gameId
    // (no comp_id), atajamos directo a autodetectar por país.
    const orgsPais = liga ? (PAIS_TO_ORGS[liga.pais] || []) : [];
    const esTrackerSospechoso = parsed.gameId && !parsed.comp_id;
    if (esTrackerSospechoso && orgsPais.length && !orgsPais.includes(parsed.org)) {
      setMsg(`ℹ URL de tracker con slug "${parsed.org}" — usando org conocido de ${liga.pais}: ${orgsPais.join(", ")}`);
      await autodetectar();
      return;
    }
    setOrg(parsed.org);
    setMsg(`✅ Detectado org=${parsed.org}${parsed.comp_id ? ` · comp_id=${parsed.comp_id}` : ""}${parsed.gameId ? ` · gameId=${parsed.gameId}` : ""}`);
    if (parsed.comp_id) {
      // Ya tenemos todo: cargar directamente los equipos
      setCompId(String(parsed.comp_id));
      setBusy(true);
      try {
        const r = await callFn("genius-inspeccionar", { org: parsed.org, comp_id: parsed.comp_id });
        if (!r?.ok) throw new Error(r?.error || "Sin datos");
        setEquiposGenius(r.equipos || []);
        setCompInfo(r.comp || "");
        setFedInfo(r.fed || "");
        preSeleccionar(r.equipos || []);
        setMsg(`✅ ${r.equipos?.length || 0} equipos cargados directamente`);
      } catch (e) {
        // Fallback: si el país tiene orgs conocidos, prueba autodetectar.
        if (orgsPais.length) {
          setMsg(`⚠ Fallo con org "${parsed.org}" — probando autodetección por país…`);
          await autodetectar();
        } else {
          setMsg(`⚠ ${e.message || e}`);
        }
      }
      finally { setBusy(false); }
    } else {
      // Solo org → listar competiciones para elegir
      setBusy(true);
      try {
        const r = await callFn("genius-inspeccionar", { org: parsed.org });
        if (!r?.ok) throw new Error(r?.error || "Sin datos");
        setComps(r.competiciones || []);
        setFedInfo(r.fed || "");
        setMsg(`✅ ${r.competiciones?.length || 0} competiciones — elige una`);
      } catch (e) {
        if (orgsPais.length) {
          setMsg(`⚠ Fallo con org "${parsed.org}" — probando autodetección por país…`);
          await autodetectar();
        } else {
          setMsg(`⚠ ${e.message || e}`);
        }
      }
      finally { setBusy(false); }
    }
  };

  // Extraído para reutilizar entre cargarEquipos y analizarUrl.
  const preSeleccionar = (equiposGen) => {
    const nuevaSel = {};
    const nm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    // Restringe candidatos a los que juegan la liga+temporada elegida (si filtro activo).
    const pool = equiposLigaTemp
      ? equipos.filter(e => equiposLigaTemp.has(e.id_equipo))
      : equipos;
    equiposGen.forEach(g => {
      const porId = pool.find(e => e.id_genius === g.id_genius);
      if (porId) { nuevaSel[g.id_genius] = porId.id_equipo; return; }
      const porNombre = pool.find(e => nm(e.nombre) === nm(g.nombre));
      if (porNombre) nuevaSel[g.id_genius] = porNombre.id_equipo;
    });
    setSeleccion(nuevaSel);
  };

  const cargarEquipos = async () => {
    if (!org.trim() || !compId) { setMsg("Elige org y competición"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await callFn("genius-inspeccionar", { org, comp_id: parseInt(compId, 10) });
      if (!r?.ok) throw new Error(r?.error || "Sin datos");
      setEquiposGenius(r.equipos || []);
      setCompInfo(r.comp || "");
      setFedInfo(r.fed || fedInfo);
      preSeleccionar(r.equipos || []);
      setMsg(`✅ ${r.equipos?.length || 0} equipos en la competición`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const vincular = async (g) => {
    const idEquipo = seleccion[g.id_genius];
    if (!idEquipo || idEquipo === "__new__") return;
    setBusy(true); setMsg("");
    try {
      const { error } = await supabase.rpc("genius_vincular_equipo", {
        p_id_equipo: idEquipo, p_id_genius: g.id_genius,
      });
      if (error) throw error;
      // Actualiza local: parche el equipo con id_genius
      setEquipos && setEquipos(prev => prev.map(e => e.id_equipo === idEquipo ? { ...e, id_genius: g.id_genius } : e));
      setMsg(`✅ Vinculado ${g.nombre} → ${equipos.find(e => e.id_equipo === idEquipo)?.nombre}`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const guardarConfigLiga = async () => {
    if (!idLiga || !org || !compId) return;
    setBusy(true); setMsg("");
    try {
      const { error } = await supabase.from("ligas").update({
        fuente_live: "genius", genius_org: org.toUpperCase(), genius_comp_id: parseInt(compId, 10),
      }).eq("id_liga", idLiga);
      if (error) throw error;
      setLigas && setLigas(prev => prev.map(l => l.id_liga === idLiga
        ? { ...l, fuente_live: "genius", genius_org: org.toUpperCase(), genius_comp_id: parseInt(compId, 10) }
        : l));
      setMsg(`✅ Liga ${idLiga} configurada con Genius`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  // Vincula automáticamente todos los equipos pre-seleccionados por id_genius o
  // por nombre exacto normalizado (los que la UI ya muestra rellenos). No toca
  // los que el usuario deba resolver a mano.
  const vincularSeguros = async () => {
    const pares = Object.entries(seleccion).filter(([g, id]) => id && id !== "__new__");
    if (!pares.length) { setMsg("⚠ Sin pre-mapeados que vincular"); return; }
    setBusy(true); setMsg("");
    let ok = 0, fail = 0;
    for (const [id_genius, id_equipo] of pares) {
      const bd = equipos.find(e => e.id_equipo === id_equipo);
      if (bd?.id_genius === parseInt(id_genius, 10)) continue; // ya vinculado
      const { error } = await supabase.rpc("genius_vincular_equipo", {
        p_id_equipo: id_equipo, p_id_genius: parseInt(id_genius, 10),
      });
      if (error) { fail++; continue; }
      ok++;
      setEquipos && setEquipos(prev => prev.map(e => e.id_equipo === id_equipo ? { ...e, id_genius: parseInt(id_genius, 10) } : e));
    }
    setBusy(false);
    setMsg(`${fail ? "⚠" : "✅"} Vinculados: ${ok} · Errores: ${fail}`);
  };

  // Guarda config Genius de la liga + invoca scraper de calendario en un click.
  const guardarYCargarCalendario = async () => {
    if (!idLiga || !org || !compId) return;
    setBusy(true); setMsg("Guardando config…");
    try {
      const { error } = await supabase.from("ligas").update({
        fuente_live: "genius", genius_org: org.toUpperCase(), genius_comp_id: parseInt(compId, 10),
      }).eq("id_liga", idLiga);
      if (error) throw error;
      setLigas && setLigas(prev => prev.map(l => l.id_liga === idLiga
        ? { ...l, fuente_live: "genius", genius_org: org.toUpperCase(), genius_comp_id: parseInt(compId, 10) }
        : l));
      setMsg("⏳ Cargando calendario…");
      const r = await callFn("cargar-calendario-genius", { id_liga: idLiga });
      if (r?.error) throw new Error(r.error);
      const res = r?.resultados?.[0] || {};
      setMsg(`✅ Guardada + calendario: ${res.creados ?? 0} creados · ${res.actualizados ?? 0} actualizados · ${res.equipos_creados ?? 0} equipos nuevos`);
    } catch (e) { setMsg(`⚠ ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const inp = { width: "100%", padding: "8px", borderRadius: "8px", border: "1.5px solid var(--fx-border)", fontSize: "13px", background: "var(--fx-card)", color: "var(--fx-text)", boxSizing: "border-box" };

  return (
    <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{ color: "var(--fx-muted)", fontSize: "12px", margin: 0 }}>
        Herramienta para introspectar Genius Sports (fibalivestats) y mapear equipos con los de tu BD antes de correr el scraper de calendario. Evita duplicados.
      </p>

      {/* Paso 1: elegir liga */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fx-muted)", display: "block", marginBottom: "4px" }}>1) LIGA (BD)</label>
        <select value={idLiga} onChange={e => setIdLiga(e.target.value)} style={inp}>
          <option value="">Selecciona liga…</option>
          {ligas.slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")).map(l => (
            <option key={l.id_liga} value={l.id_liga}>
              {l.nombre} ({l.pais}) {l.fuente_live === "genius" ? "✅" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de temporada: acota los equipos BD que aparecen en los dropdowns */}
      {idLiga && (
        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fx-muted)", display: "block", marginBottom: "4px" }}>
            2) TEMPORADA (para filtrar equipos BD) {equiposLigaTemp && <span style={{ color: "var(--fx-muted2)", fontWeight: 400 }}>· {equiposLigaTemp.size} equipos</span>}
          </label>
          <select value={temporada} onChange={e => setTemporada(e.target.value)} style={inp} disabled={!temporadasLiga.length}>
            {!temporadasLiga.length && <option value="">Sin temporadas en BD para esta liga</option>}
            {temporadasLiga.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Autodetección: intenta encontrar la competición con solo el país+nombre de la liga */}
      {idLiga && !liga?.genius_org && (
        <div style={{ background: "var(--fx-lila-bg)", border: "1.5px solid var(--fx-lila-border)", borderRadius: "10px", padding: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fx-lila-text)", marginBottom: "8px" }}>
            🪄 AUTODETECTAR desde el país de la liga
          </div>
          <div style={{ fontSize: "11px", color: "var(--fx-muted)", marginBottom: "8px" }}>
            País: <b>{liga?.pais || "?"}</b> · Orgs conocidos: <b>{(PAIS_TO_ORGS[liga?.pais] || []).join(", ") || "ninguno"}</b>
          </div>
          <button onClick={autodetectar} disabled={busy || !(PAIS_TO_ORGS[liga?.pais] || []).length} style={{ background: "#9333ea", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: (busy || !(PAIS_TO_ORGS[liga?.pais] || []).length) ? 0.5 : 1 }}>
            {busy ? "Buscando…" : "🪄 Autodetectar competición"}
          </button>
          {autoCandidatas && autoCandidatas.length > 0 && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {autoCandidatas.map((c, i) => (
                <button key={`${c.org}-${c.comp_id}`} onClick={() => aplicarCandidata(c)} disabled={busy} style={{ textAlign: "left", background: i === 0 ? "var(--fx-green-bg)" : "var(--fx-card)", border: i === 0 ? "1.5px solid var(--fx-green-border)" : "1px solid var(--fx-border)", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fx-text)" }}>{c.nombre}</div>
                    <div style={{ fontSize: "10px", color: "var(--fx-muted2)" }}>{c.fed} · {c.org} · comp_id {c.comp_id}</div>
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: c.score >= 0.5 ? "#16a34a" : "#a16207" }}>{Math.round(c.score * 100)}%</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Atajo: pegar URL Genius */}
      {idLiga && (
        <div style={{ background: "var(--fx-hover)", borderRadius: "10px", padding: "10px 12px" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fx-muted)", display: "block", marginBottom: "4px" }}>
            🔗 ATAJO: PEGA URL DE GENIUS (tracker, schedule…)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={urlPegar}
              onChange={e => setUrlPegar(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") analizarUrl(); }}
              placeholder="https://fibalivestats.dcd.shared.geniussports.com/u/…"
              style={inp}
            />
            <button onClick={analizarUrl} disabled={busy || !urlPegar.trim()} style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: (busy || !urlPegar.trim()) ? 0.5 : 1, whiteSpace: "nowrap" }}>
              Analizar URL
            </button>
          </div>
          <div style={{ fontSize: "10px", color: "var(--fx-muted2)", marginTop: "4px" }}>
            Detecta org y comp_id automáticamente. Si la URL es de un partido en vivo, saca solo el org y luego eliges la competición.
          </div>
        </div>
      )}

      {idLiga && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fx-muted)", display: "block", marginBottom: "4px" }}>2) CÓDIGO GENIUS (ORG)</label>
            <input value={org} onChange={e => setOrg(e.target.value.toUpperCase())} placeholder="WBBL, KKI, BB, DAM…" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fx-muted)", display: "block", marginBottom: "4px" }}>3) COMPETITION ID</label>
            <select value={compId} onChange={e => setCompId(e.target.value)} style={inp} disabled={!comps}>
              <option value="">{comps ? "Elige competición…" : "Primero busca ↓"}</option>
              {(comps || []).map(c => (
                <option key={c.comp_id} value={c.comp_id}>{c.nombre} ({c.comp_id})</option>
              ))}
            </select>
          </div>
          <button onClick={buscarComps} disabled={busy || !org} style={{ background: "#9333ea", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: (busy || !org) ? 0.5 : 1 }}>
            🔍 Buscar
          </button>
        </div>
      )}

      {idLiga && compId && (
        <button onClick={cargarEquipos} disabled={busy} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: busy ? 0.5 : 1, alignSelf: "flex-start" }}>
          📥 Cargar equipos de esta competición
        </button>
      )}

      {fedInfo && <div style={{ fontSize: "11px", color: "var(--fx-muted2)" }}>Federación: <b>{fedInfo}</b>{compInfo ? ` · Competición: ${compInfo}` : ""}</div>}
      {msg && <div style={{ fontSize: "12px", color: msg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{msg}</div>}

      {/* Tabla de mapeo */}
      {equiposGenius && (
        <>
          <div style={{ background: "var(--fx-hover)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", color: "var(--fx-label)" }}>
            {equiposGenius.length} equipos en Genius · {Object.keys(seleccion).length} pre-mapeados por nombre/id
          </div>
          <div style={{ border: "1px solid var(--fx-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", padding: "8px 12px", background: "var(--fx-hover)", fontSize: "10px", fontWeight: 700, color: "var(--fx-muted)", textTransform: "uppercase" }}>
              <div>Genius</div><div>Equipo BD</div><div></div>
            </div>
            {equiposGenius.map(g => {
              const sel = seleccion[g.id_genius] || "";
              const bd = equipos.find(e => e.id_equipo === sel);
              const vinculado = bd?.id_genius === g.id_genius;
              return (
                <div key={g.id_genius} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", padding: "8px 12px", alignItems: "center", borderTop: "1px solid var(--fx-border2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    {g.logo ? <img loading="lazy" decoding="async" src={g.logo} alt="" style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} /> : <span style={{ width: 24, height: 24, background: "var(--fx-border)", borderRadius: 3, flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--fx-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nombre}</div>
                      <div style={{ fontSize: "10px", color: "var(--fx-muted2)" }}>ID {g.id_genius}</div>
                    </div>
                  </div>
                  <select
                    value={sel}
                    onChange={e => setSeleccion(prev => ({ ...prev, [g.id_genius]: e.target.value }))}
                    style={{ ...inp, padding: "6px 8px", fontSize: "12px" }}>
                    <option value="">— sin match —</option>
                    {equiposBD.map(e => (
                      <option key={e.id_equipo} value={e.id_equipo}>
                        {e.id_genius === g.id_genius ? "✓ " : ""}{e.nombre} ({e.id_equipo})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => vincular(g)}
                    disabled={busy || !sel || vinculado}
                    style={{ background: vinculado ? "#16a34a" : "#9333ea", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 700, fontSize: "11px", cursor: (busy || !sel || vinculado) ? "default" : "pointer", opacity: (busy || !sel || vinculado) ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {vinculado ? "✓ vinculado" : "Vincular"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Acciones batch: vincular seguros + guardar config + guardar+scrape */}
          <div style={{ borderTop: "1px solid var(--fx-border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={vincularSeguros} disabled={busy || Object.keys(seleccion).length === 0} style={{ background: "#9333ea", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: (busy || Object.keys(seleccion).length === 0) ? 0.5 : 1 }}>
                🪄 Vincular todos los seguros ({Object.keys(seleccion).length})
              </button>
              <button onClick={guardarConfigLiga} disabled={busy} style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                💾 Guardar config liga
              </button>
              <button onClick={guardarYCargarCalendario} disabled={busy} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                🚀 Guardar + cargar calendario
              </button>
            </div>
            <div style={{ fontSize: "11px", color: "var(--fx-muted)" }}>
              Vincular seguros ejecuta <code>genius_vincular_equipo</code> para todos los mapeos ya prellenados (por id_genius o nombre exacto). Guardar+cargar calendario marca <code>fuente_live='genius'</code> y dispara el scraper en un solo click.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CalidadModal;
