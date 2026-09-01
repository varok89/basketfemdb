import { useMemo, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "../lib/supabaseClient";

const ZONAS = ["Mundo", "Africa", "Americas", "Asia", "Europe"];
const ZONA_LABEL = { Mundo: "🌍 Mundo", Africa: "🌍 África", Americas: "🌎 Américas", Asia: "🌏 Asia", Europe: "🌍 Europa" };

export default function RankingFibaView({ equipos, isAdmin, onGoToTeam, onReload }) {
  const [zona, setZona] = useState("Mundo");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
    setBusy(true); setMsg("");
    try {
      const url = SUPABASE_URL + "/functions/v1/cargar-ranking-fiba";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
        body: JSON.stringify({ gender: "women", crear_faltantes: true, dry: false }),
      });
      const d = await r.json();
      if (!d.ok) setMsg("❌ " + (d.error || "Error"));
      else {
        setMsg(`✅ ${d.actualizados} actualizados · ${d.creados} creados · ${d.aprendidos_org_id} aprendieron org_id`);
        if (onReload) await onReload();
      }
    } catch (e) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", padding: "16px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: "22px", color: "#1e293b", margin: 0 }}>🌐 Ranking FIBA · Mujeres</h1>
          {updated && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Última actualización: {updated.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</div>}
        </div>
        {isAdmin && (
          <button onClick={actualizar} disabled={busy}
            style={{ background: busy ? "#94a3b8" : "#9333ea", color: "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontWeight: 700, fontSize: "13px", cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Actualizando…" : "🔄 Actualizar ranking"}
          </button>
        )}
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: msg.startsWith("✅") ? "#059669" : "#dc2626", border: "1px solid " + (msg.startsWith("✅") ? "#6ee7b7" : "#fecaca"), borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "13px", fontWeight: 600 }}>{msg}</div>
      )}

      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {ZONAS.map(z => (
          <button key={z} onClick={() => setZona(z)}
            style={{ background: zona === z ? "#9333ea" : "#f1f5f9", color: zona === z ? "#fff" : "#475569", border: "none", borderRadius: "999px", padding: "7px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
            {ZONA_LABEL[z]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: "14px" }}>
          Sin datos de ranking para esta zona.{isAdmin && " Pulsa \"Actualizar ranking\" arriba."}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px 80px", padding: "10px 14px", background: "#f8fafc", fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ textAlign: "center" }}>#</div>
            <div>País</div>
            <div style={{ textAlign: "right" }}>Puntos</div>
            <div style={{ textAlign: "right" }}>Zona</div>
          </div>
          {rows.map(e => (
            <div key={e.id_equipo} onClick={() => onGoToTeam && onGoToTeam(e.id_equipo)}
              style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px 80px", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
              <div style={{ textAlign: "center", fontSize: "16px", fontWeight: 800, color: e.fiba_rank <= 3 ? "#9333ea" : "#1e293b" }}>{e.fiba_rank}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {e.escudo && <img src={e.escudo} alt="" style={{ width: "28px", height: "20px", objectFit: "cover", borderRadius: "3px", boxShadow: "0 0 0 1px #e2e8f0" }} />}
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>{e.nombre}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{Number(e.fiba_puntos).toFixed(1)}</div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{e.fiba_zona || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
