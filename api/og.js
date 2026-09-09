// Genera OG image dinamica para compartir en redes sociales.
// URL: /api/og?tipo=jugadora&id=J0123
//      /api/og?tipo=equipo&id=E001
//      /api/og?tipo=partido&id=5491
//
// La imagen es 1200x630 (standard OG). Se cachea 1h en edge.

import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const SUPA_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPA_KEY = process.env.REACT_APP_SUPABASE_KEY;
const BRAND = "#9333ea";
const BG = "#0f172a";

function html(children, extra = {}) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex", flexDirection: "column", width: "100%", height: "100%",
        background: `linear-gradient(135deg, ${BG} 0%, #1e293b 60%, ${BG} 100%)`,
        color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "60px",
        ...extra,
      },
      children,
    },
  };
}

function footer() {
  return {
    type: "div",
    props: {
      style: { display: "flex", alignItems: "center", marginTop: "auto", gap: "12px", color: "#94a3b8", fontSize: "24px" },
      children: [
        { type: "div", props: { style: { fontSize: "28px" }, children: "🏀" } },
        { type: "div", props: { children: "labasketneta.app" } },
      ],
    },
  };
}

async function jugadoraCard(id) {
  const supa = createClient(SUPA_URL, SUPA_KEY);
  const { data: p } = await supa.from("jugadoras").select("nombre,foto,posicion,nacionalidad,altura_cm").eq("id_jugadora", id).maybeSingle();
  if (!p) return null;
  const rows = [
    { type: "div", props: { style: { fontSize: "72px", fontWeight: 900, color: "#fff", lineHeight: 1.1 }, children: p.nombre } },
    {
      type: "div", props: {
        style: { fontSize: "28px", color: "#a78bfa", marginTop: "12px", display: "flex", gap: "16px" },
        children: [p.posicion, p.nacionalidad, p.altura_cm ? `${p.altura_cm} cm` : null].filter(Boolean).map((s, i) => ({
          type: "div", props: { key: i, children: s },
        })),
      },
    },
  ];
  const left = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 },
      children: [{ type: "div", props: { style: { fontSize: "22px", color: BRAND, fontWeight: 700, marginBottom: "16px", letterSpacing: "3px" }, children: "JUGADORA" } }, ...rows],
    },
  };
  const right = p.foto ? {
    type: "img",
    props: { src: p.foto, width: 360, height: 360, style: { borderRadius: "50%", objectFit: "cover", border: `6px solid ${BRAND}` } },
  } : null;
  return html([{ type: "div", props: { style: { display: "flex", gap: "40px", alignItems: "center", flex: 1 }, children: [left, right].filter(Boolean) } }, footer()]);
}

async function equipoCard(id) {
  const supa = createClient(SUPA_URL, SUPA_KEY);
  const { data: e } = await supa.from("equipos").select("nombre,escudo,ciudad,pais").eq("id_equipo", id).maybeSingle();
  if (!e) return null;
  const left = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 },
      children: [
        { type: "div", props: { style: { fontSize: "22px", color: BRAND, fontWeight: 700, marginBottom: "16px", letterSpacing: "3px" }, children: "EQUIPO" } },
        { type: "div", props: { style: { fontSize: "68px", fontWeight: 900, color: "#fff", lineHeight: 1.1 }, children: e.nombre } },
        { type: "div", props: { style: { fontSize: "28px", color: "#a78bfa", marginTop: "12px" }, children: [e.ciudad, e.pais].filter(Boolean).join(" · ") } },
      ],
    },
  };
  const right = e.escudo ? {
    type: "img",
    props: { src: e.escudo, width: 280, height: 280, style: { objectFit: "contain" } },
  } : null;
  return html([{ type: "div", props: { style: { display: "flex", gap: "40px", alignItems: "center", flex: 1 }, children: [left, right].filter(Boolean) } }, footer()]);
}

async function partidoCard(id) {
  const supa = createClient(SUPA_URL, SUPA_KEY);
  const { data: p } = await supa.from("partidos").select("id,fecha_hora,resultado_local,resultado_visitante,notas,id_equipo_local,id_equipo_visitante,id_liga").eq("id", id).maybeSingle();
  if (!p) return null;
  const eqIds = [p.id_equipo_local, p.id_equipo_visitante].filter(Boolean);
  const { data: eqs } = await supa.from("equipos").select("id_equipo,nombre,escudo").in("id_equipo", eqIds);
  const { data: liga } = await supa.from("ligas").select("nombre").eq("id_liga", p.id_liga).maybeSingle();
  const eqL = (eqs || []).find(e => e.id_equipo === p.id_equipo_local) || {};
  const eqV = (eqs || []).find(e => e.id_equipo === p.id_equipo_visitante) || {};
  const played = p.resultado_local != null;
  const winL = played && Number(p.resultado_local) > Number(p.resultado_visitante);
  const equipoCol = (eq, score, isWinner) => ({
    type: "div", props: {
      style: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: "16px", opacity: played && !isWinner ? 0.55 : 1 },
      children: [
        eq.escudo ? { type: "img", props: { src: eq.escudo, width: 180, height: 180, style: { objectFit: "contain" } } } : { type: "div", props: { style: { width: 180, height: 180, background: "#334155", borderRadius: "12px" } } },
        { type: "div", props: { style: { fontSize: "34px", fontWeight: 800, color: "#fff", textAlign: "center" }, children: eq.nombre || "—" } },
        played ? { type: "div", props: { style: { fontSize: "96px", fontWeight: 900, color: isWinner ? "#4ade80" : "#f1f5f9" }, children: String(score) } } : null,
      ].filter(Boolean),
    },
  });
  const dt = p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
  return html([
    { type: "div", props: { style: { fontSize: "22px", color: BRAND, fontWeight: 700, letterSpacing: "3px" }, children: (liga?.nombre || "PARTIDO").toUpperCase() } },
    { type: "div", props: { style: { fontSize: "20px", color: "#94a3b8", marginBottom: "20px" }, children: [dt, p.notas].filter(Boolean).join(" · ") } },
    {
      type: "div", props: {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, gap: "20px" },
        children: [
          equipoCol(eqL, p.resultado_local, played && winL),
          played ? null : { type: "div", props: { style: { fontSize: "72px", color: "#94a3b8", fontWeight: 800 }, children: "vs" } },
          equipoCol(eqV, p.resultado_visitante, played && !winL),
        ].filter(Boolean),
      },
    },
    footer(),
  ]);
}

async function defaultCard() {
  return html([
    { type: "div", props: { style: { fontSize: "22px", color: BRAND, fontWeight: 700, letterSpacing: "3px" }, children: "LA BASKETNETA" } },
    { type: "div", props: { style: { fontSize: "84px", fontWeight: 900, color: "#fff", lineHeight: 1.05, marginTop: "20px" }, children: "Base de datos del baloncesto femenino" } },
    { type: "div", props: { style: { fontSize: "28px", color: "#94a3b8", marginTop: "24px" }, children: "Jugadoras, equipos, ligas y estadísticas de todo el mundo" } },
    footer(),
  ]);
}

export default async function handler(req) {
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  const id = url.searchParams.get("id");
  let content = null;
  try {
    if (tipo === "jugadora" && id) content = await jugadoraCard(id);
    else if (tipo === "equipo" && id) content = await equipoCard(id);
    else if (tipo === "partido" && id) content = await partidoCard(id);
  } catch (e) {
    console.error("[og]", e.message);
  }
  if (!content) content = await defaultCard();
  return new ImageResponse(content, {
    width: 1200, height: 630,
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
