import { lazy } from "react";

// Envuelve React.lazy con auto-reload cuando el chunk deja de existir tras
// un deploy nuevo (users con la app abierta tienen HTML viejo apuntando a
// chunks .js con hash caducado). Sentry LABASKETNETA-6.
// Anti-loop: si ya recargamos y sigue fallando, dejamos que el error suba
// a Sentry en vez de recargar en bucle.
const CHUNK_RELOAD_FLAG = "chunk-reload-attempted";
try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG); } catch {}

function isChunkLoadError(msg){
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|Unexpected token '<'/i.test(msg);
}

export function lazyWithRetry(factory){
  return lazy(async ()=>{
    try { return await factory(); }
    catch(err){
      const msg = String(err?.message||"");
      if(!isChunkLoadError(msg)) throw err;
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1"; } catch {}
      if(alreadyReloaded) throw err;
      try { sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1"); } catch {}
      if(typeof window !== "undefined" && window.location) window.location.reload();
      return { default: ()=>null };
    }
  });
}
