// Analytics propio. Escribe en tabla `visitas` vía /api/track.
// - trackPageview(path, {user, esAdmin, referrer}): 1 fila por cambio de tab.
// - trackEvento(nombre, meta, {user, esAdmin, path}): 1 fila con evento+meta jsonb.
// Los admins nunca se trackean (esAdmin true → no-op).

import { supabase } from "./supabaseClient";

const SID_KEY = "bf_sid";
const SID_TS_KEY = "bf_sid_ts";
const SID_TTL_MS = 30 * 60 * 1000;

function sessionId() {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(SID_TS_KEY) || 0);
    let sid = localStorage.getItem(SID_KEY);
    if (!sid || (now - last) > SID_TTL_MS) {
      sid = (crypto?.randomUUID?.() || String(now) + Math.random().toString(36).slice(2));
      localStorage.setItem(SID_KEY, sid);
    }
    localStorage.setItem(SID_TS_KEY, String(now));
    return sid;
  } catch { return String(Date.now()) + Math.random().toString(36).slice(2); }
}

async function post(payload) {
  try {
    const r = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!r.ok) throw 0;
  } catch {
    try {
      await supabase.from("visitas").insert({ ...payload, user_agent: (navigator.userAgent || "").slice(0, 500) || null });
    } catch {}
  }
}

export function trackPageview(path, { user, esAdmin, referrer } = {}) {
  if (esAdmin) return;
  if (!path) return;
  post({
    path: String(path).slice(0, 500),
    referrer: (referrer ?? document.referrer ?? "").slice(0, 2000) || null,
    session_id: sessionId(),
    id_usuario: user?.id || null,
  });
}

export function trackEvento(nombre, meta, { user, esAdmin, path } = {}) {
  if (esAdmin) return;
  if (!nombre) return;
  post({
    path: String(path || location.pathname || "/").slice(0, 500),
    evento: String(nombre).slice(0, 60),
    meta: meta && typeof meta === "object" ? meta : null,
    session_id: sessionId(),
    id_usuario: user?.id || null,
  });
}

// Contexto compartido para que las vistas no tengan que pasar user/esAdmin.
// App.jsx llama setTrackContext({user, esAdmin}) cuando cambian.
let ctx = { user: null, esAdmin: false };
export function setTrackContext(next) { ctx = { ...ctx, ...(next || {}) }; }
export function evento(nombre, meta, extraPath) {
  return trackEvento(nombre, meta, { ...ctx, path: extraPath });
}
