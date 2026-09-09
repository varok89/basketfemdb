import { useSyncExternalStore } from "react";
import { STRINGS_ES } from "./i18n_es";
import { STRINGS_EN } from "./i18n_en";

const DICTS = { es: STRINGS_ES, en: STRINGS_EN };
const listeners = new Set();

let currentLang = "es";
try {
  const saved = localStorage.getItem("bfdb-lang");
  if (saved && DICTS[saved]) currentLang = saved;
} catch {}
try { document.documentElement.setAttribute("lang", currentLang); } catch {}

export function getLang(){ return currentLang; }
export function setLang(l){
  if(!DICTS[l]||l===currentLang) return;
  currentLang = l;
  try{ localStorage.setItem("bfdb-lang", l); }catch{}
  try{ document.documentElement.setAttribute("lang", l); }catch{}
  listeners.forEach(fn=>fn());
}

function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
function getSnapshot(){ return currentLang; }

export function useLang(){
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useT(){
  const lang = useLang();
  const dict = DICTS[lang] || DICTS.es;
  return (key, params) => {
    let s = dict[key];
    if (s === undefined) s = DICTS.es[key];
    if (s === undefined) s = key;
    if (params) Object.keys(params).forEach(k => { s = s.replace(new RegExp("\\{"+k+"\\}","g"), params[k]); });
    return s;
  };
}

export function locale(lang = currentLang){
  return lang === "en" ? "en-GB" : "es-ES";
}

const FASE_MAP_EN = {
  "cuartos de final": "Quarter-Finals",
  "cuarto de final": "Quarter-Final",
  "semifinal": "Semi-Final",
  "semifinales": "Semi-Finals",
  "final": "Final",
  "tercer puesto": "Third place",
  "octavos de final": "Round of 16",
  "octavo de final": "Round of 16",
  "clasificacion a cuartos": "Qualification to QF",
  "clasificación a cuartos": "Qualification to QF",
  "grupo": "Group",
  "fase de grupos": "Group Phase",
};
export function traducirFase(fase, lang = currentLang){
  if(!fase || lang === "es") return fase;
  const low = String(fase).toLowerCase();
  for (const k of Object.keys(FASE_MAP_EN)) {
    if (low.startsWith(k)) return FASE_MAP_EN[k] + fase.slice(k.length);
  }
  return fase;
}
