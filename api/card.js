// Genera card 1080x1080 de jugadora en partido concreto.
// URL: /api/card?jugadora=J0123&partido=38717
// Layout: fondo halftone + card blanco con logo centrado, foto a la izquierda,
// marcador + stats a la derecha, nombre + %tiros en pie.

import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

const COL_TEXT = "#1f2937";
const COL_MUTED = "#6b7280";

function el(type, style, children) {
  const props = { style };
  if (children !== undefined) props.children = children;
  return { type, props };
}
function img(src, w, h, style = {}) {
  return { type: "img", props: { src, width: w, height: h, style: { objectFit: "contain", ...style } } };
}

async function datos(jugadora, partido) {
  const supa = createClient(SUPA_URL, SUPA_KEY);
  const [j, p, bx] = await Promise.all([
    supa.from("jugadoras").select("nombre,foto").eq("id_jugadora", jugadora).maybeSingle(),
    supa.from("partidos").select("id,fecha_hora,resultado_local,resultado_visitante,id_equipo_local,id_equipo_visitante,id_liga").eq("id", partido).maybeSingle(),
    supa.from("partido_boxscore").select("*").eq("id_partido", partido).eq("id_jugadora", jugadora).maybeSingle(),
  ]);
  if (!j.data || !p.data || !bx.data) return null;
  const [eqs, liga] = await Promise.all([
    supa.from("equipos").select("id_equipo,nombre,escudo").in("id_equipo", [p.data.id_equipo_local, p.data.id_equipo_visitante]),
    supa.from("ligas").select("nombre").eq("id_liga", p.data.id_liga).maybeSingle(),
  ]);
  const eqL = (eqs.data || []).find(e => e.id_equipo === p.data.id_equipo_local) || {};
  const eqV = (eqs.data || []).find(e => e.id_equipo === p.data.id_equipo_visitante) || {};
  return { jug: j.data, par: p.data, box: bx.data, eqL, eqV, liga: liga.data?.nombre || "" };
}

function pct(a, i) { const A = Number(a) || 0, I = Number(i) || 0; return I ? Math.round(A / I * 1000) / 10 : 0; }
function parseMin(m) {
  if (m == null) return 0;
  const s = String(m);
  if (s.includes(":")) { const [a] = s.split(":"); return parseInt(a, 10) || 0; }
  return Math.floor(Number(s) || 0);
}

function card(d, baseUrl) {
  const BG = `${baseUrl}/share-card/bg.jpg`;
  const LOGO = `${baseUrl}/share-card/logo.png`;
  const foto = d.jug.foto;
  const nombre = d.jug.nombre || "";
  const liga = d.liga || "";
  const score = `${d.par.resultado_local ?? "-"} - ${d.par.resultado_visitante ?? "-"}`;
  const mins = parseMin(d.box.minutos);
  const pts = d.box.puntos || 0;
  const reb = d.box.reb_totales || 0;
  const ast = d.box.asistencias || 0;
  const val = d.box.valoracion || 0;
  const t2m = (d.box.tc_anotados || 0) - (d.box.t3_anotados || 0);
  const t2i = (d.box.tc_intentados || 0) - (d.box.t3_intentados || 0);
  const pT2 = pct(t2m, t2i);
  const pT3 = pct(d.box.t3_anotados, d.box.t3_intentados);
  const pTL = pct(d.box.tl_anotados, d.box.tl_intentados);

  const text = (txt, style) => el("div", { display: "flex", ...style }, txt);

  const statRow = (icon, label, value) => el("div", {
    display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px",
  }, [
    text(icon, { fontSize: "30px" }),
    text(`${label}: ${value}`, { fontSize: "26px", fontWeight: 800, color: COL_TEXT }),
  ]);

  const escudoJugadora = d.box.id_equipo === d.par.id_equipo_local ? d.eqL.escudo : d.eqV.escudo;

  const PHOTO = 360;
  const root = el("div", {
    width: "100%", height: "100%", display: "flex", position: "relative",
    backgroundImage: `url(${BG})`, backgroundSize: "cover", backgroundPosition: "center",
    padding: "28px",
  }, [
    el("div", {
      flex: 1, display: "flex", flexDirection: "column",
      background: "#f5efe8", borderRadius: "24px", padding: "60px 36px 28px 36px",
      position: "relative",
    }, [
      el("div", {
        position: "absolute", top: "-26px", left: "410px",
        width: "120px", height: "120px", display: "flex",
      }, [
        img(LOGO, 120, 120),
      ]),
      el("div", {
        display: "flex", flex: 1, marginTop: "72px", gap: "24px",
      }, [
        // Foto + escudo al 30% detras
        el("div", {
          width: `${PHOTO}px`, height: `${PHOTO}px`, display: "flex", position: "relative",
          justifyContent: "center", alignItems: "center",
        }, [
          escudoJugadora ? el("div", {
            position: "absolute", top: 0, left: 0, width: `${PHOTO}px`, height: `${PHOTO}px`,
            display: "flex", justifyContent: "center", alignItems: "center", opacity: 0.28,
          }, [
            img(escudoJugadora, PHOTO, PHOTO),
          ]) : null,
          foto ? img(foto, PHOTO, PHOTO, { objectFit: "contain", position: "relative" })
               : text("👤", { fontSize: "120px" }),
        ].filter(Boolean)),
        el("div", {
          flex: 1, display: "flex", flexDirection: "column", gap: "8px",
        }, [
          text(liga.toUpperCase(), { fontSize: "22px", fontWeight: 800, color: COL_TEXT, letterSpacing: "1px" }),
          el("div", { display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }, [
            d.eqL.escudo ? img(d.eqL.escudo, 60, 60) : el("div", { width: 60, height: 60, display: "flex" }, []),
            el("div", { display: "flex", flex: 1, justifyContent: "center", fontSize: "48px", fontWeight: 900, color: COL_TEXT }, score),
            d.eqV.escudo ? img(d.eqV.escudo, 60, 60) : el("div", { width: 60, height: 60, display: "flex" }, []),
          ]),
          statRow("⏱️", "MINUTOS", mins),
          statRow("🏀", "PUNTOS", pts),
          statRow("📊", "REBOTES", reb),
          statRow("🤾", "ASISTENCIAS", ast),
          statRow("🏆", "VALORACIÓN", val),
        ]),
      ]),
      el("div", { display: "flex", flexDirection: "column", marginTop: "18px", alignItems: "center" }, [
        el("div", { display: "flex", width: "60%", height: "2px", background: COL_TEXT, marginBottom: "12px" }, []),
        text(nombre.toUpperCase(), { fontSize: "40px", fontWeight: 900, color: COL_TEXT, letterSpacing: "1px" }),
        text(`T2: ${pT2}%  |  T3: ${pT3}%  |  TL: ${pTL}%`, { fontSize: "22px", fontWeight: 700, color: COL_MUTED, marginTop: "6px" }),
      ]),
    ]),
  ]);
  return root;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const jugadora = url.searchParams.get("jugadora");
  const partido = url.searchParams.get("partido");
  if (!jugadora || !partido) return new Response("missing jugadora/partido", { status: 400 });

  const baseUrl = `${url.protocol}//${url.host}`;
  try {
    const d = await datos(jugadora, parseInt(partido, 10));
    if (!d) return new Response(JSON.stringify({ error: "sin datos (jugadora, partido o boxscore no existe)" }), { status: 404, headers: { "Content-Type": "application/json" } });
    return new ImageResponse(card(d, baseUrl), {
      width: 1080, height: 1080,
      headers: { "cache-control": "public, max-age=300, s-maxage=300" },
    });
  } catch (e) {
    console.error("[card]", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
