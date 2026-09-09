import { useMemo, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT, useLang, locale } from "../lib/i18n";

const ZONA_KEYS_LIST = ["Mundo", "Africa", "Americas", "Asia", "Europe"];
const ZONA_I18N = {
  Mundo: "ranking.zone.world",
  Africa: "ranking.zone.africa",
  Americas: "ranking.zone.americas",
  Asia: "ranking.zone.asia",
  Europe: "ranking.zone.europe",
};

const HEADER_STYLE = {
  display: "grid", gridTemplateColumns: "60px 1fr 90px 80px",
  padding: "10px 14px", background: "var(--fx-hover)",
  fontSize: "11px", fontWeight: 800, color: "var(--fx-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px",
  borderBottom: "1px solid var(--fx-border)",
};

const ROW_STYLE = {
  display: "grid", gridTemplateColumns: "60px 1fr 90px 80px",
  alignItems: "center", padding: "10px 14px",
  borderBottom: "1px solid var(--fx-border2)", cursor: "pointer",
};

const ZONA_KEYS = new Set(ZONA_KEYS_LIST);

export default function RankingFibaView({ equipos, isAdmin, onGoToTeam, onReload }) {
  const t = useT();
  const lang = useLang();
  const ZONAS = ZONA_KEYS_LIST.map(k => ({ key: k, label: t(ZONA_I18N[k]) }));
  const [zona, setZonaRaw] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("zona");
      return q && ZONA_KEYS.has(q) ? q : "Mundo";
    } catch { return "Mundo"; }
  });
  const setZona = v => {
    setZonaRaw(v);
    try {
      const url = new URL(window.location.href);
      if (v && v !== "Mundo") url.searchParams.set("zona", v); else url.searchParams.delete("zona");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    } catch {}
  };
  useEffect(() => {
    const onPop = () => {
      try {
        const q = new URLSearchParams(window.location.search).get("zona");
        setZonaRaw(q && ZONA_KEYS.has(q) ? q : "Mundo");
      } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'err', texto }

  const rows = useMemo(() => {
    return (equipos || [])
      .filter(e => e.fiba_rank != null)
      .filter(e => zona === "Mundo" || e.fiba_zona === zona)
      .sort((a, b) => a.fiba_rank - b.fiba_rank);
  }, [equipos, zona]);

  const updated = useMemo(() => {
    const ts = rows.map(e => e.fiba_rank_updated).filter(Boolean).sort().pop();
    return ts ? new Date(ts) : null;
  }, [rows]);

  async function actualizar() {
    if (!confirm("Descargar el ranking actual de FIBA y actualizar la BD (crea selecciones que falten)?")) return;
    setBusy(true); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("cargar-ranking-fiba", {
        body: { gender: "women", crear_faltantes: true, dry: false },
      });
      if (error) setMsg({ tipo: "err", texto: error.message });
      else if (!data?.ok) setMsg({ tipo: "err", texto: data?.error || "Error" });
      else {
        setMsg({ tipo: "ok", texto: `${data.actualizados} actualizados · ${data.creados} creados · ${data.aprendidos_org_id} aprendieron org_id` });
        if (onReload) await onReload();
      }
    } catch (e) { setMsg({ tipo: "err", texto: e.message }); }
    setBusy(false);
  }

  const isOk = msg?.tipo === "ok";

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", padding: "16px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: "22px", color: "var(--fx-text)", margin: 0 }}>{t("ranking.title")}</h1>
          {updated && <div style={{ fontSize: "12px", color: "var(--fx-muted)", marginTop: "4px" }}>{t("ranking.updated", { fecha: updated.toLocaleDateString(locale(lang), { year: "numeric", month: "long", day: "numeric" }) })}</div>}
        </div>
        {isAdmin && (
          <button onClick={actualizar} disabled={busy}
            style={{ background: busy ? "#94a3b8" : "#9333ea", color: "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontWeight: 700, fontSize: "13px", cursor: busy ? "wait" : "pointer" }}>
            {busy ? t("ranking.updating") : t("ranking.update")}
          </button>
        )}
      </div>

      {msg && (
        <div style={{ background: isOk ? "#ecfdf5" : "#fef2f2", color: isOk ? "#059669" : "#dc2626", border: "1px solid " + (isOk ? "#6ee7b7" : "#fecaca"), borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "13px", fontWeight: 600 }}>
          {(isOk ? "✅ " : "❌ ") + msg.texto}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {ZONAS.map(z => (
          <button key={z.key} onClick={() => setZona(z.key)}
            style={{ background: zona === z.key ? "#9333ea" : "var(--fx-hover)", color: zona === z.key ? "#fff" : "var(--fx-label)", border: "none", borderRadius: "999px", padding: "7px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
            {z.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fx-muted2)", background: "var(--fx-card)", borderRadius: "14px" }}>
          {t("ranking.empty")}{isAdmin && t("ranking.empty.admin")}
        </div>
      ) : (
        <div style={{ background: "var(--fx-card)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <div style={HEADER_STYLE}>
            <div style={{ textAlign: "center" }}>{t("ranking.col.rank")}</div>
            <div>{t("ranking.col.country")}</div>
            <div style={{ textAlign: "right" }}>{t("ranking.col.points")}</div>
            <div style={{ textAlign: "right" }}>{t("ranking.col.zone")}</div>
          </div>
          {rows.map(e => (
            <div key={e.id_equipo} onClick={() => onGoToTeam && onGoToTeam(e.id_equipo)} style={ROW_STYLE}>
              <div style={{ textAlign: "center", fontSize: "16px", fontWeight: 800, color: e.fiba_rank <= 3 ? "#9333ea" : "var(--fx-text)" }}>{e.fiba_rank}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {e.escudo && <img loading="lazy" decoding="async" src={e.escudo} alt="" style={{ width: "28px", height: "20px", objectFit: "cover", borderRadius: "3px", boxShadow: "0 0 0 1px var(--fx-border)" }} />}
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--fx-text)" }}>{e.nombre}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 700, color: "var(--fx-text)" }}>{Number(e.fiba_puntos).toFixed(1)}</div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--fx-muted)", fontWeight: 600 }}>{e.fiba_zona || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
