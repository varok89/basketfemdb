// src/views/EuroligaView.jsx
// Quiniela EuroLeague Women desbloqueable por fases.
// Datos en public.euroliga_config / euroliga_predicciones / euroliga_resultados.
// RPC: euroliga_guardar (valida fase abierta), euroliga_ranking (público).
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const TEMPORADA = "2026-27";
const ID_LIGA = "L004";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function estadoFase(fase, resultadosByPid) {
  const now = Date.now();
  const apertura = new Date(fase.fecha_apertura).getTime();
  const cierre = new Date(fase.fecha_cierre).getTime();
  if (now < apertura) return "bloqueada";
  if (now < cierre) return "abierta";
  const preguntas = fase.preguntas || [];
  const todasResueltas = preguntas.length > 0 && preguntas.every(q => resultadosByPid[q.id]);
  return todasResueltas ? "resuelta" : "esperando";
}

const BADGE = {
  bloqueada: { emo: "🔒", label: "Bloqueada", bg: "var(--fx-hover)", color: "var(--fx-muted)" },
  abierta:   { emo: "✏️", label: "Abierta",   bg: "rgba(147,51,234,0.15)", color: "#9333ea" },
  esperando: { emo: "🔐", label: "Cerrada — esperando resultado", bg: "rgba(234,179,8,0.15)", color: "#a16207" },
  resuelta:  { emo: "✅", label: "Resuelta",  bg: "rgba(34,197,94,0.15)",  color: "#16a34a" },
};

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const diff = target - now;
  if (diff <= 0) return "cerrada";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function EquipoChips({ opciones, seleccion, onChange, nMax, disabled }) {
  const sel = new Set(seleccion || []);
  const toggle = (id) => {
    if (disabled) return;
    const nueva = new Set(sel);
    if (nueva.has(id)) nueva.delete(id);
    else {
      if (nMax === 1) nueva.clear();
      if (nueva.size >= nMax) return;
      nueva.add(id);
    }
    onChange([...nueva]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {opciones.map(o => {
        const activo = sel.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            disabled={disabled}
            aria-pressed={activo}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: activo ? "#9333ea" : "var(--fx-hover)",
              color: activo ? "#fff" : "var(--fx-label)",
              border: activo ? "1.5px solid #7c3aed" : "1.5px solid var(--fx-border)",
              borderRadius: "20px", padding: "6px 12px",
              fontSize: "12px", fontWeight: 700, cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.7 : 1,
            }}>
            {o.escudo && <img src={o.escudo} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />}
            <span>{o.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

function InputLibre({ value, onChange, placeholder, disabled }) {
  return (
    <input
      type="text"
      value={value?.[0] || ""}
      onChange={e => onChange(e.target.value ? [e.target.value] : [])}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: "100%", background: "var(--fx-card)", color: "var(--fx-text)",
        border: "1.5px solid var(--fx-border)", borderRadius: "10px",
        padding: "9px 12px", fontSize: "13px", outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

function Pregunta({ pregunta, opcionesPorSource, misIds, resultadoIds, estado, onGuardar, equiposMap }) {
  const [borrador, setBorrador] = useState(misIds || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setBorrador(misIds || []); }, [misIds]);

  const opciones = pregunta.opciones_source === "libre"
    ? null
    : opcionesPorSource[pregunta.opciones_source] || [];

  const disabled = estado !== "abierta";
  const cambio = JSON.stringify(borrador) !== JSON.stringify(misIds || []);
  const nMax = pregunta.n_respuestas || 1;

  const guardar = async () => {
    setSaving(true); setMsg("");
    try {
      await onGuardar(pregunta.id, borrador);
      setMsg("✅ Guardado");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(`⚠ ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const puntosGanados = resultadoIds ? (
    borrador.filter(id => resultadoIds.includes(id)).length * (pregunta.puntos_por_acierto || 0)
  ) : null;

  const nombreEquipo = (id) => equiposMap[id]?.nombre || id;

  return (
    <div style={{ padding: "12px 14px", borderTop: "1px solid var(--fx-border2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fx-text)" }}>{pregunta.titulo}</div>
          <div style={{ fontSize: "11px", color: "var(--fx-muted2)", marginTop: "2px" }}>
            {nMax > 1 ? `Elige ${nMax}` : "Elige 1"} · {pregunta.puntos_por_acierto} pts por acierto
          </div>
        </div>
        {resultadoIds && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: puntosGanados > 0 ? "#16a34a" : "var(--fx-muted)" }}>
              +{puntosGanados} pts
            </div>
            <div style={{ fontSize: "10px", color: "var(--fx-muted2)" }}>
              Real: {resultadoIds.map(nombreEquipo).join(", ")}
            </div>
          </div>
        )}
      </div>

      {opciones === null ? (
        <InputLibre
          value={borrador}
          onChange={setBorrador}
          disabled={disabled}
          placeholder={pregunta.tipo === "jugadora" ? "Nombre de la jugadora" : "Respuesta"}
        />
      ) : opciones.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--fx-muted2)", fontStyle: "italic", padding: "8px 0" }}>
          Aún no se conocen los equipos de este bracket. Se rellenará cuando termine la fase anterior.
        </div>
      ) : (
        <EquipoChips opciones={opciones} seleccion={borrador} onChange={setBorrador} nMax={nMax} disabled={disabled} />
      )}

      {!disabled && (
        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={guardar}
            disabled={saving || !cambio || borrador.length === 0}
            style={{
              background: "#9333ea", color: "#fff", border: "none",
              borderRadius: "10px", padding: "7px 16px", fontWeight: 700, fontSize: "12px",
              cursor: (saving || !cambio || borrador.length === 0) ? "default" : "pointer",
              opacity: (saving || !cambio || borrador.length === 0) ? 0.5 : 1,
            }}>
            {saving ? "Guardando…" : cambio ? "Guardar" : "Guardado"}
          </button>
          {msg && <span style={{ fontSize: "11px", color: msg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

function FaseCard({ fase, opcionesPorSource, misPredsByPid, resultadosByPid, onGuardar, equiposMap }) {
  const estado = estadoFase(fase, resultadosByPid);
  const badge = BADGE[estado];
  const countdown = useCountdown(new Date(fase.fecha_cierre).getTime());

  return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: "14px", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--fx-border2)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>{badge.emo}</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--fx-text)" }}>{fase.titulo}</h3>
          </div>
          {fase.descripcion && (
            <div style={{ fontSize: "12px", color: "var(--fx-muted)", marginTop: "4px" }}>{fase.descripcion}</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ background: badge.bg, color: badge.color, borderRadius: "20px", padding: "3px 10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
            {badge.label}
          </span>
          <div style={{ fontSize: "10px", color: "var(--fx-muted2)", marginTop: "4px" }}>
            {estado === "abierta" && `Cierra en ${countdown} · ${fmtDate(fase.fecha_cierre)}`}
            {estado === "bloqueada" && `Abre el ${fmtDate(fase.fecha_apertura)}`}
            {estado === "esperando" && `Cerró el ${fmtDate(fase.fecha_cierre)}`}
            {estado === "resuelta" && `Resuelta`}
          </div>
        </div>
      </div>
      {estado === "bloqueada" ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--fx-muted2)", fontSize: "13px" }}>
          Esta fase se desbloquea cuando termine la anterior.
        </div>
      ) : (fase.preguntas || []).map(q => (
        <Pregunta
          key={q.id}
          pregunta={q}
          opcionesPorSource={opcionesPorSource}
          misIds={misPredsByPid[q.id]}
          resultadoIds={resultadosByPid[q.id]}
          estado={estado}
          onGuardar={onGuardar}
          equiposMap={equiposMap}
        />
      ))}
    </div>
  );
}

function Ranking({ user }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("euroliga_ranking", { p_temporada: TEMPORADA });
      if (!error) setRows(data || []);
      else setRows([]);
    })();
  }, []);
  if (!rows) return null;
  if (rows.length === 0) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "20px", textAlign: "center", color: "var(--fx-muted)", fontSize: "13px" }}>
      Aún nadie tiene puntos. Empieza a predecir para aparecer aquí.
    </div>
  );
  return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "14px 16px" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 800, color: "var(--fx-text)" }}>🏆 Ranking</h3>
      {rows.slice(0, 20).map((r, i) => (
        <div key={r.user_id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "6px 0", borderTop: i > 0 ? "1px solid var(--fx-border2)" : "none",
          background: r.user_id === user?.id ? "rgba(147,51,234,0.06)" : "transparent",
        }}>
          <div style={{ fontSize: "12px", color: "var(--fx-text)" }}>
            <span style={{ fontWeight: 700, marginRight: "8px", color: "var(--fx-muted)" }}>#{i + 1}</span>
            {r.user_id === user?.id ? <b>Tú</b> : <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.user_id.slice(0, 8)}…</span>}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#9333ea" }}>{r.total_pts} pts</div>
        </div>
      ))}
    </div>
  );
}

export default function EuroligaView({ user, equipos = [] }) {
  const [config, setConfig] = useState(null);
  const [misPreds, setMisPreds] = useState({});
  const [resultados, setResultados] = useState({});
  const [gruposEquipos, setGruposEquipos] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const equiposMap = useMemo(() => {
    const m = {};
    (equipos || []).forEach(e => { m[e.id_equipo] = e; });
    return m;
  }, [equipos]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setErr("");
      const [cfg, res, parts] = await Promise.all([
        supabase.from("euroliga_config").select("*").eq("temporada", TEMPORADA).order("orden"),
        supabase.from("euroliga_resultados").select("pregunta_id, ids").eq("temporada", TEMPORADA),
        supabase.from("partidos").select("id_equipo_local, id_equipo_visitante, notas")
          .eq("id_liga", ID_LIGA).eq("temporada", TEMPORADA).like("notas", "Temporada regular%"),
      ]);
      if (cancel) return;
      if (cfg.error) { setErr(cfg.error.message); setLoading(false); return; }
      setConfig(cfg.data || []);
      const r = {}; (res.data || []).forEach(x => { r[x.pregunta_id] = x.ids; });
      setResultados(r);
      const gru = { A: new Set(), B: new Set(), C: new Set(), D: new Set() };
      (parts.data || []).forEach(p => {
        const m = /Grupo (.)/.exec(p.notas || "");
        if (!m) return;
        const g = m[1];
        if (!gru[g]) return;
        if (p.id_equipo_local) gru[g].add(p.id_equipo_local);
        if (p.id_equipo_visitante) gru[g].add(p.id_equipo_visitante);
      });
      const gruObj = {};
      Object.keys(gru).forEach(k => { gruObj[k] = [...gru[k]]; });
      setGruposEquipos(gruObj);

      if (user?.id) {
        const { data: mp } = await supabase.from("euroliga_predicciones")
          .select("pregunta_id, respuesta_ids")
          .eq("temporada", TEMPORADA)
          .eq("user_id", user.id);
        const m = {}; (mp || []).forEach(x => { m[x.pregunta_id] = x.respuesta_ids; });
        if (!cancel) setMisPreds(m);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  const opcionesPorSource = useMemo(() => {
    const out = {};
    ["A", "B", "C", "D"].forEach(g => {
      const ids = gruposEquipos[g] || [];
      out[`grupo_${g}_2026_27`] = ids
        .map(id => equiposMap[id])
        .filter(Boolean)
        .map(e => ({ id: e.id_equipo, nombre: e.nombre, escudo: e.escudo }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    const todos = new Set();
    Object.values(gruposEquipos).forEach(arr => arr.forEach(id => todos.add(id)));
    out["euroliga_2026_27"] = [...todos]
      .map(id => equiposMap[id])
      .filter(Boolean)
      .map(e => ({ id: e.id_equipo, nombre: e.nombre, escudo: e.escudo }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    out["grupo_E_2026_27"] = [];
    out["grupo_F_2026_27"] = [];
    out["playins_2026_27"] = [];
    out["f6_2026_27"] = [];
    return out;
  }, [gruposEquipos, equiposMap]);

  const onGuardar = useCallback(async (pregunta_id, respuesta_ids) => {
    if (!user?.id) throw new Error("Necesitas iniciar sesión");
    const { error } = await supabase.rpc("euroliga_guardar", {
      p_temporada: TEMPORADA, p_pregunta_id: pregunta_id, p_respuesta_ids: respuesta_ids,
    });
    if (error) throw error;
    setMisPreds(prev => ({ ...prev, [pregunta_id]: respuesta_ids }));
  }, [user?.id]);

  if (loading) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "40px", textAlign: "center", color: "var(--fx-muted)", fontSize: "13px" }}>
      Cargando quiniela…
    </div>
  );
  if (err) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "20px", color: "#dc2626", fontSize: "13px" }}>
      ⚠ {err}
    </div>
  );
  if (!user) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "40px", textAlign: "center", color: "var(--fx-muted)", fontSize: "13px" }}>
      Necesitas iniciar sesión para participar en la quiniela.
    </div>
  );

  return (
    <div>
      {(config || []).map(f => (
        <FaseCard
          key={f.fase}
          fase={f}
          opcionesPorSource={opcionesPorSource}
          misPredsByPid={misPreds}
          resultadosByPid={resultados}
          onGuardar={onGuardar}
          equiposMap={equiposMap}
        />
      ))}
      <div style={{ marginTop: "20px" }}>
        <Ranking user={user} />
      </div>
    </div>
  );
}
