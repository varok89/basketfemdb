// Genera card de jugadora en partido concreto.
// URL: /api/card?jugadora=J0123&partido=38717
// Config leida de public.app_config key='card' (editable vía /#admin/card-editor).
// Query params extra sobreescriben config (preview sin tocar BD).

import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

const DEFAULTS = {
  fontFamily: "Oswald",
  fontWeight: 700,
  colText: "#1f2937",
  colMuted: "#6b7280",
  cardBg: "#f5efe8",
  cardBorderRadius: 24,
  outerPadding: 28,
  innerPaddingTop: 52,
  innerPaddingSide: 32,
  innerPaddingBottom: 24,
  colGap: 64,
  photoSize: 560,
  logoSize: 120,
  logoLeft: 452,
  logoTop: -26,
  rayaBottom: 40,
  escudoOpacity: 0.22,
  equipoLogoSize: 70,
  ligaLogoSize: 44,
  nombreSize: 60,
  ligaSize: 22,
  scoreSize: 54,
  tirosSize: 24,
  statSize: 36,
  statIconSize: 34,
  divisorHeight: 3,
  statSpacerTop: 2,
  statSpacerBottom: 5,
  width: 1080,
  height: 1080,
};

const FONT_URLS = {
  "Oswald": [
    ["https://cdn.jsdelivr.net/npm/@fontsource/oswald/files/oswald-latin-400-normal.woff", 400],
    ["https://cdn.jsdelivr.net/npm/@fontsource/oswald/files/oswald-latin-700-normal.woff", 700],
  ],
  "Bebas Neue": [
    ["https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff", 400],
  ],
  "Barlow Condensed": [
    ["https://cdn.jsdelivr.net/npm/@fontsource/barlow-condensed/files/barlow-condensed-latin-400-normal.woff", 400],
    ["https://cdn.jsdelivr.net/npm/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff", 800],
  ],
  "Inter": [
    ["https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff", 400],
    ["https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff", 700],
  ],
};

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
    supa.from("jugadoras").select("nombre,foto,nacionalidad").eq("id_jugadora", jugadora).maybeSingle(),
    supa.from("partidos").select("id,fecha_hora,resultado_local,resultado_visitante,id_equipo_local,id_equipo_visitante,id_liga").eq("id", partido).maybeSingle(),
    supa.from("partido_boxscore").select("*").eq("id_partido", partido).eq("id_jugadora", jugadora).maybeSingle(),
  ]);
  if (!j.data || !p.data || !bx.data) return null;
  const [eqs, liga] = await Promise.all([
    supa.from("equipos").select("id_equipo,nombre,escudo").in("id_equipo", [p.data.id_equipo_local, p.data.id_equipo_visitante]),
    supa.from("ligas").select("nombre,logo").eq("id_liga", p.data.id_liga).maybeSingle(),
  ]);
  const eqL = (eqs.data || []).find(e => e.id_equipo === p.data.id_equipo_local) || {};
  const eqV = (eqs.data || []).find(e => e.id_equipo === p.data.id_equipo_visitante) || {};
  return { jug: j.data, par: p.data, box: bx.data, eqL, eqV, liga: liga.data?.nombre || "", ligaLogo: liga.data?.logo || null };
}

async function loadConfig() {
  try {
    const supa = createClient(SUPA_URL, SUPA_KEY);
    const { data } = await supa.from("app_config").select("value").eq("key", "card").maybeSingle();
    return { ...DEFAULTS, ...(data?.value || {}) };
  } catch { return { ...DEFAULTS }; }
}

function fotoSinBg(url) {
  if (!url) return url;
  if (!url.includes("assets.fiba.basketball/image/upload/")) return url;
  return url.replace("/image/upload/", "/image/upload/e_bgremoval,w_700,h_700,c_fit/");
}

function pct(a, i) { const A = Number(a) || 0, I = Number(i) || 0; return I ? Math.round(A / I * 1000) / 10 : 0; }
function parseMin(m) {
  if (m == null) return 0;
  const s = String(m);
  if (s.includes(":")) { const [a] = s.split(":"); return parseInt(a, 10) || 0; }
  return Math.floor(Number(s) || 0);
}

function card(d, baseUrl, cfg) {
  const BG = `${baseUrl}/share-card/bg.jpg`;
  const LOGO = `${baseUrl}/share-card/logo.png`;
  const foto = fotoSinBg(d.jug.foto);
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

  const FF = cfg.fontFamily;
  const FW = cfg.fontWeight;
  const text = (txt, style) => el("div", { display: "flex", ...style }, txt);

  const statRow = (icon, label, value) => el("div", {
    display: "flex", alignItems: "center", gap: "14px",
  }, [
    text(icon, { fontSize: `${cfg.statIconSize}px` }),
    text(`${label}: ${value}`, { fontSize: `${cfg.statSize}px`, fontWeight: FW, color: cfg.colText, fontFamily: FF, letterSpacing: "0.5px" }),
  ]);

  const escudoJugadora = d.box.id_equipo === d.par.id_equipo_local ? d.eqL.escudo : d.eqV.escudo;
  const PHOTO = cfg.photoSize;

  const root = el("div", {
    width: "100%", height: "100%", display: "flex", position: "relative",
    backgroundImage: `url(${BG})`, backgroundSize: "cover", backgroundPosition: "center",
    padding: `${cfg.outerPadding}px`,
  }, [
    el("div", {
      flex: 1, display: "flex", flexDirection: "column",
      background: cfg.cardBg, borderRadius: `${cfg.cardBorderRadius}px`,
      padding: `${cfg.innerPaddingTop}px ${cfg.innerPaddingSide}px ${cfg.innerPaddingBottom}px ${cfg.innerPaddingSide}px`,
      position: "relative",
    }, [
      escudoJugadora ? el("div", {
        position: "absolute", top: 0, left: 0, bottom: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center", opacity: cfg.escudoOpacity,
        borderRadius: `${cfg.cardBorderRadius}px`, overflow: "hidden",
      }, [
        img(escudoJugadora, 900, 900),
      ]) : null,
      el("div", {
        position: "absolute", top: `${cfg.logoTop}px`, left: `${cfg.logoLeft}px`,
        width: `${cfg.logoSize}px`, height: `${cfg.logoSize}px`, display: "flex",
      }, [
        img(LOGO, cfg.logoSize, cfg.logoSize),
      ]),
      el("div", {
        display: "flex", flex: 1, marginTop: "72px", gap: `${cfg.colGap}px`,
      }, [
        el("div", { display: "flex", flexDirection: "column", width: `${PHOTO}px`, position: "relative" }, [
          el("div", {
            width: `${PHOTO}px`, height: `${PHOTO}px`, display: "flex", position: "relative",
          }, [
            el("div", {
              position: "absolute", left: 0, bottom: `${cfg.rayaBottom}px`, width: "100%", height: `${cfg.divisorHeight}px`,
              background: cfg.colText, display: "flex",
            }, []),
            foto ? el("div", {
              position: "absolute", left: 0, bottom: 0, width: `${PHOTO}px`, height: `${PHOTO}px`,
              display: "flex", justifyContent: "center", alignItems: "flex-end",
            }, [
              img(foto, PHOTO, PHOTO, { objectFit: "contain" }),
            ]) : text("👤", { fontSize: "120px" }),
          ]),
          text(nombre.toUpperCase(), { fontSize: `${cfg.nombreSize}px`, fontWeight: FW, color: cfg.colText, letterSpacing: "2px", fontFamily: FF, lineHeight: 0.95, marginTop: "10px" }),
          text(`T2 ${t2m}/${t2i} (${pT2}%)  |  T3 ${d.box.t3_anotados || 0}/${d.box.t3_intentados || 0} (${pT3}%)  |  TL ${d.box.tl_anotados || 0}/${d.box.tl_intentados || 0} (${pTL}%)`, { fontSize: `${cfg.tirosSize}px`, fontWeight: FW, color: cfg.colText, fontFamily: FF, marginTop: "10px", letterSpacing: "0.5px" }),
        ].filter(Boolean)),
        el("div", {
          flex: 1, display: "flex", flexDirection: "column",
        }, [
          el("div", { display: "flex", flexDirection: "column" }, [
            el("div", { display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }, [
              d.ligaLogo ? img(d.ligaLogo, cfg.ligaLogoSize, cfg.ligaLogoSize) : null,
              text(liga.toUpperCase(), { fontSize: `${cfg.ligaSize}px`, fontWeight: FW, color: cfg.colText, letterSpacing: "1px", fontFamily: FF }),
            ].filter(Boolean)),
            el("div", { display: "flex", alignItems: "center", gap: "14px" }, [
              d.eqL.escudo ? img(d.eqL.escudo, cfg.equipoLogoSize, cfg.equipoLogoSize) : el("div", { width: cfg.equipoLogoSize, height: cfg.equipoLogoSize, display: "flex" }, []),
              el("div", { display: "flex", flex: 1, justifyContent: "center", fontSize: `${cfg.scoreSize}px`, fontWeight: FW, color: cfg.colText, fontFamily: FF, lineHeight: 1, letterSpacing: "1px", whiteSpace: "nowrap" }, score),
              d.eqV.escudo ? img(d.eqV.escudo, cfg.equipoLogoSize, cfg.equipoLogoSize) : el("div", { width: cfg.equipoLogoSize, height: cfg.equipoLogoSize, display: "flex" }, []),
            ]),
          ]),
          el("div", { display: "flex", flex: cfg.statSpacerTop }, []),
          el("div", { display: "flex", flexDirection: "column" }, [
            statRow("⏱️", "MINUTOS", mins),
            statRow("🏀", "PUNTOS", pts),
            statRow("📊", "REBOTES", reb),
            statRow("🤾", "ASISTENCIAS", ast),
            statRow("🏆", "VALORACIÓN", val),
          ]),
          el("div", { display: "flex", flex: cfg.statSpacerBottom }, []),
        ]),
      ]),
    ].filter(Boolean)),
  ]);
  return root;
}

const UMBRAL_ESPECIAL = 25;

const PAIS_A_ISO2 = {
  "España":"es","Estados Unidos":"us","USA":"us","Francia":"fr","Alemania":"de","Italia":"it",
  "Reino Unido":"gb","Portugal":"pt","Bélgica":"be","Países Bajos":"nl","Holanda":"nl",
  "Suecia":"se","Noruega":"no","Finlandia":"fi","Dinamarca":"dk","Islandia":"is","Irlanda":"ie",
  "Suiza":"ch","Austria":"at","Polonia":"pl","República Checa":"cz","Chequia":"cz",
  "Eslovaquia":"sk","Hungría":"hu","Rumanía":"ro","Bulgaria":"bg","Grecia":"gr",
  "Croacia":"hr","Serbia":"rs","Eslovenia":"si","Bosnia y Herzegovina":"ba","Montenegro":"me",
  "Macedonia del Norte":"mk","Albania":"al","Kosovo":"xk","Turquía":"tr","Rusia":"ru",
  "Ucrania":"ua","Bielorrusia":"by","Lituania":"lt","Letonia":"lv","Estonia":"ee",
  "Canadá":"ca","México":"mx","Brasil":"br","Argentina":"ar","Chile":"cl","Colombia":"co",
  "Venezuela":"ve","Uruguay":"uy","Paraguay":"py","Perú":"pe","Ecuador":"ec",
  "República Dominicana":"do","Puerto Rico":"pr","Cuba":"cu",
  "Australia":"au","Nueva Zelanda":"nz","Japón":"jp","China":"cn","Corea del Sur":"kr",
  "Filipinas":"ph","Taiwán":"tw","India":"in","Israel":"il",
  "Nigeria":"ng","Senegal":"sn","Mali":"ml","Malí":"ml","Camerún":"cm","Costa de Marfil":"ci",
  "Egipto":"eg","Marruecos":"ma","Túnez":"tn","Angola":"ao","Mozambique":"mz","Sudáfrica":"za",
  "República Democrática del Congo":"cd",
};

function cardEspecial(d, baseUrl) {
  const BG = `${baseUrl}/share-card/especial-bg.svg`;
  const LOGO = `${baseUrl}/share-card/logo.png`;
  const foto = fotoSinBg(d.jug.foto);
  const nombre = (d.jug.nombre || "").toUpperCase();
  const val = d.box.valoracion || 0;
  const pts = d.box.puntos || 0;
  const reb = d.box.reb_totales || 0;
  const ast = d.box.asistencias || 0;
  const rob = d.box.robos || 0;
  const tap = d.box.tapones || 0;
  const iso = PAIS_A_ISO2[d.jug.nacionalidad] || null;
  const banderaUrl = iso ? `https://flagcdn.com/w80/${iso}.png` : null;
  const escudo = d.box.id_equipo === d.par.id_equipo_local ? d.eqL.escudo : d.eqV.escudo;

  const FF = "Oswald";
  const abs = (style) => ({ display: "flex", position: "absolute", ...style });

  const stat = (left, num, label) => el("div", abs({
    left: `${left}px`, top: "1010px", width: "140px", flexDirection: "column",
    alignItems: "center", fontFamily: FF, color: "#ffffff",
  }), [
    el("div", { display: "flex", fontSize: "70px", fontWeight: 800, lineHeight: 1 }, String(num)),
    el("div", { display: "flex", fontSize: "26px", fontWeight: 700, color: "#fed7aa", marginTop: "4px", letterSpacing: "2px" }, label),
  ]);

  return el("div", {
    width: "100%", height: "100%", display: "flex", position: "relative",
    background: "#000000",
  }, [
    el("div", abs({ top: 0, left: 0, width: "1080px", height: "1350px" }), [
      img(BG, 1080, 1350, { objectFit: "fill" }),
    ]),
    el("div", abs({ top: "70px", left: "490px", width: "100px", height: "100px" }), [
      img(LOGO, 100, 100),
    ]),
    el("div", abs({ top: "220px", left: "110px", width: "280px", flexDirection: "column", fontFamily: FF, color: "#ffffff" }), [
      el("div", { display: "flex", fontSize: "180px", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-4px" }, String(val)),
      el("div", { display: "flex", fontSize: "48px", fontWeight: 700, letterSpacing: "4px", marginTop: "10px" }, "VAL"),
    ]),
    foto ? el("div", abs({ top: "300px", left: "340px", width: "400px", height: "500px", justifyContent: "center", alignItems: "flex-end" }), [
      img(foto, 400, 500, { objectFit: "contain" }),
    ]) : null,
    el("div", abs({ top: "870px", left: 0, width: "1080px", justifyContent: "center", fontFamily: FF, color: "#ffffff", fontSize: "70px", fontWeight: 800, letterSpacing: "3px" }), nombre),
    el("div", abs({ top: "975px", left: "140px", width: "800px", height: "4px", background: "#f97316" }), []),
    el("div", abs({ top: "1140px", left: "140px", width: "800px", height: "4px", background: "#f97316" }), []),
    stat(120, pts, "PTS"),
    stat(300, reb, "REB"),
    stat(470, ast, "AST"),
    stat(640, rob, "ROB"),
    stat(820, tap, "TAP"),
    el("div", abs({ top: "1190px", left: 0, width: "1080px", justifyContent: "center", alignItems: "center", gap: "40px" }), [
      banderaUrl ? img(banderaUrl, 80, 54) : el("div", { display: "flex", width: "80px", height: "54px" }, []),
      d.ligaLogo ? img(d.ligaLogo, 80, 80) : el("div", { display: "flex", width: "80px", height: "80px" }, []),
      escudo ? img(escudo, 90, 90) : el("div", { display: "flex", width: "90px", height: "90px" }, []),
    ]),
  ].filter(Boolean));
}

async function loadFont(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`font ${url} ${r.status}`);
  return await r.arrayBuffer();
}

export default async function handler(req) {
  const url = new URL(req.url);
  const jugadora = url.searchParams.get("jugadora");
  const partido = url.searchParams.get("partido");
  if (!jugadora || !partido) return new Response("missing jugadora/partido", { status: 400 });

  const baseUrl = `${url.protocol}//${url.host}`;
  try {
    const cfg = await loadConfig();
    for (const [k, v] of url.searchParams.entries()) {
      if (k === "jugadora" || k === "partido" || k === "preview" || k === "bust") continue;
      if (k in cfg) {
        const num = Number(v);
        cfg[k] = isNaN(num) || v === "" ? v : num;
      }
    }

    const fontList = FONT_URLS[cfg.fontFamily] || FONT_URLS["Oswald"];
    const [d, ...fonts] = await Promise.all([
      datos(jugadora, parseInt(partido, 10)),
      ...fontList.map(([u]) => loadFont(u)),
    ]);
    if (!d) return new Response(JSON.stringify({ error: "sin datos (jugadora, partido o boxscore no existe)" }), { status: 404, headers: { "Content-Type": "application/json" } });

    const isPreview = url.searchParams.get("preview") === "1";
    const forzar = url.searchParams.get("estilo");
    const esEspecial = forzar === "especial" || (forzar !== "dorada" && (d.box.valoracion || 0) >= UMBRAL_ESPECIAL);
    const tree = esEspecial ? cardEspecial(d, baseUrl) : card(d, baseUrl, cfg);
    const [w, h] = esEspecial ? [1080, 1350] : [cfg.width, cfg.height];
    return new ImageResponse(tree, {
      width: w, height: h,
      fonts: fonts.map((data, i) => ({ name: cfg.fontFamily, data, weight: fontList[i][1], style: "normal" })),
      headers: { "cache-control": isPreview ? "no-store" : "public, max-age=60, s-maxage=60" },
    });
  } catch (e) {
    console.error("[card]", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
