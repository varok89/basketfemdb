// src/views/EuroligaView.jsx
// Quiniela EuroLeague Women desbloqueable por fases.
// Datos: public.euroliga_config / euroliga_predicciones / euroliga_resultados.
// RPCs: euroliga_guardar (valida fase abierta), euroliga_ranking.
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

// ─── Dropdown custom con escudo + nombre ────────────────────
function EquipoSelect({ opciones, value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const current = opciones.find(o => o.id === value);
  const escudo = (url, size = 18) => url
    ? <img loading="lazy" decoding="async" src={url} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, background: "var(--fx-border)", borderRadius: 3, flexShrink: 0 }} />;
  useEffect(() => {
    if (!open) return;
    const h = e => setOpen(false);
    // Cerrar al hacer click fuera (con delay para no cerrar al abrir)
    const t = setTimeout(() => document.addEventListener("click", h), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", h); };
  }, [open]);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); if (!disabled) setOpen(o => !o); }}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: "6px", width: "100%",
          padding: "5px 8px", fontSize: "12px",
          border: "1px solid var(--fx-border)", borderRadius: "6px",
          background: disabled ? "var(--fx-hover)" : "var(--fx-card)",
          color: "var(--fx-text)", cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left", outline: "none",
        }}>
        {current ? (
          <>
            {escudo(current.escudo)}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.nombre}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: "var(--fx-muted2)" }}>{placeholder || "—"}</span>
        )}
        <span style={{ fontSize: "9px", color: "var(--fx-muted2)" }}>▾</span>
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 50,
            background: "var(--fx-card)", border: "1px solid var(--fx-border)",
            borderRadius: "8px", boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            maxHeight: "260px", overflowY: "auto",
          }}>
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "6px 10px", background: "transparent", border: "none",
              fontSize: "11px", color: "var(--fx-muted2)", cursor: "pointer", fontStyle: "italic",
              borderBottom: "1px solid var(--fx-border2)",
            }}>
            — Quitar selección
          </button>
          {opciones.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px", width: "100%",
                padding: "6px 10px", background: o.id === value ? "var(--fx-hover)" : "transparent",
                border: "none", fontSize: "12px", color: "var(--fx-text)",
                textAlign: "left", cursor: "pointer",
              }}
              onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = "var(--fx-hover)"; }}
              onMouseLeave={e => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}>
              {escudo(o.escudo, 20)}
              <span style={{ flex: 1 }}>{o.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de un grupo con 4 posiciones ordenables ────────────
function GrupoCard({ grupo, equiposGrupo, misPredsByPid, resultadosByPid, disabled, onGuardar }) {
  // 4 slots: reg_{grupo}_1 .. reg_{grupo}_4
  const slots = [1, 2, 3, 4];
  const slotId = pos => `reg_${grupo}_${pos}`;
  const puntosPos = { 1: 2, 2: 1, 3: 1, 4: 2 };
  const bgPos = { 1: "var(--fx-green-bg)", 2: "var(--fx-amber-bg)", 3: "var(--fx-amber-bg)", 4: "var(--fx-red-bg)" };
  const colorPos = { 1: "var(--fx-green-text)", 2: "var(--fx-amber-text)", 3: "var(--fx-amber-text)", 4: "var(--fx-red-text)" };

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const cambiar = async (pos, id) => {
    if (disabled) return;
    setSaving(true); setMsg("");
    try {
      await onGuardar(slotId(pos), id ? [id] : []);
    } catch (e) {
      setMsg(`⚠ ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // Excluir equipos ya usados en otras posiciones del mismo grupo
  const opcionesPara = (pos) => {
    const usados = new Set(slots.filter(p => p !== pos)
      .map(p => (misPredsByPid[slotId(p)] || [])[0])
      .filter(Boolean));
    return equiposGrupo.filter(e => !usados.has(e.id));
  };

  const puntosGrupo = slots.reduce((acc, pos) => {
    const real = resultadosByPid[slotId(pos)];
    const mio = misPredsByPid[slotId(pos)];
    if (!real || !mio) return acc;
    return acc + (real[0] === mio[0] ? puntosPos[pos] : 0);
  }, 0);
  const hayResultado = slots.some(pos => resultadosByPid[slotId(pos)]);

  return (
    <div style={{ border: "1px solid var(--fx-border)", borderRadius: "10px", padding: "10px", background: "var(--fx-card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--fx-muted)" }}>Grupo {grupo}</div>
        {hayResultado && (
          <div style={{ fontSize: "12px", fontWeight: 800, color: puntosGrupo > 0 ? "#16a34a" : "var(--fx-muted)" }}>
            +{puntosGrupo} pts
          </div>
        )}
      </div>
      {equiposGrupo.length === 0 ? (
        <div style={{ fontSize: "11px", color: "var(--fx-muted2)", fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
          Equipos aún no confirmados
        </div>
      ) : slots.map(pos => {
        const real = resultadosByPid[slotId(pos)];
        const mio = misPredsByPid[slotId(pos)];
        const acierto = real && mio && real[0] === mio[0];
        return (
          <div key={pos} style={{
            display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px",
            background: bgPos[pos], borderRadius: "6px", padding: "4px 6px",
            border: real ? (acierto ? "1px solid #16a34a" : "1px solid #ef4444") : "1px solid transparent",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: colorPos[pos], minWidth: "18px", textAlign: "center" }}>{pos}º</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EquipoSelect
                opciones={opcionesPara(pos)}
                value={(mio || [])[0]}
                onChange={v => cambiar(pos, v)}
                disabled={disabled || saving}
                placeholder="—"
              />
            </div>
            <span style={{ fontSize: "9px", color: "var(--fx-muted2)", fontWeight: 700, minWidth: "26px", textAlign: "right" }}>{puntosPos[pos]}pt</span>
          </div>
        );
      })}
      {msg && <div style={{ fontSize: "10px", color: "#dc2626", marginTop: "4px" }}>{msg}</div>}
    </div>
  );
}

// ─── Dropdown de jugadora con foto + equipo ──────────────────
function JugadoraSelect({ opciones, value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = opciones.find(o => o.id === value);
  const foto = (url, size = 24) => url
    ? <img loading="lazy" decoding="async" src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--fx-border2)" }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: "var(--fx-hover)", flexShrink: 0 }} />;
  const esc = (url, size = 14) => url
    ? <img loading="lazy" decoding="async" src={url} alt="" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
    : null;
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    const t = setTimeout(() => document.addEventListener("click", h), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", h); };
  }, [open]);
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nq = norm(q);
  const filtradas = nq ? opciones.filter(o => norm(o.nombre).includes(nq) || norm(o.equipoNombre).includes(nq)) : opciones;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); if (!disabled) { setOpen(o => !o); setQ(""); } }}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: "8px", width: "100%",
          padding: "5px 8px", fontSize: "12px",
          border: "1px solid var(--fx-border)", borderRadius: "6px",
          background: disabled ? "var(--fx-hover)" : "var(--fx-card)",
          color: "var(--fx-text)", cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left", outline: "none",
        }}>
        {current ? (
          <>
            {foto(current.foto, 22)}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {current.nombre}
            </span>
            {esc(current.equipoEscudo)}
          </>
        ) : (
          <span style={{ flex: 1, color: "var(--fx-muted2)" }}>{placeholder || "Selecciona jugadora"}</span>
        )}
        <span style={{ fontSize: "9px", color: "var(--fx-muted2)" }}>▾</span>
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 50,
            background: "var(--fx-card)", border: "1px solid var(--fx-border)",
            borderRadius: "8px", boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            maxHeight: "320px", overflowY: "auto",
          }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--fx-border2)", background: "var(--fx-card)", position: "sticky", top: 0 }}>
            <input
              autoFocus
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar…"
              style={{ width: "100%", padding: "5px 8px", fontSize: "11px", border: "1px solid var(--fx-border)", borderRadius: "6px", background: "var(--fx-card)", color: "var(--fx-text)", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 10px", background: "transparent", border: "none", fontSize: "10px", color: "var(--fx-muted2)", cursor: "pointer", fontStyle: "italic", borderBottom: "1px solid var(--fx-border2)" }}>
            — Quitar selección
          </button>
          {filtradas.length === 0 && (
            <div style={{ padding: "10px", fontSize: "11px", color: "var(--fx-muted2)", textAlign: "center" }}>Sin resultados</div>
          )}
          {filtradas.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px", width: "100%",
                padding: "6px 10px", background: o.id === value ? "var(--fx-hover)" : "transparent",
                border: "none", fontSize: "12px", color: "var(--fx-text)",
                textAlign: "left", cursor: "pointer",
              }}
              onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = "var(--fx-hover)"; }}
              onMouseLeave={e => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}>
              {foto(o.foto, 26)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{o.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--fx-muted)" }}>
                  {esc(o.equipoEscudo, 12)}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.equipoNombre}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pregunta simple (Bola de Cristal) ──────────────────────
function PreguntaSimple({ pregunta, opcionesPorSource, misIds, resultadoIds, disabled, onGuardar, equiposMap, jugadorasMap }) {
  const [borrador, setBorrador] = useState(misIds || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setBorrador(misIds || []); }, [misIds]);

  const opciones = pregunta.opciones_source === "libre" ? null : opcionesPorSource[pregunta.opciones_source] || [];
  const cambio = JSON.stringify(borrador) !== JSON.stringify(misIds || []);
  const nombreEquipo = (id) => equiposMap[id]?.nombre || id;
  const nombreJugadora = (id) => jugadorasMap?.[id]?.nombre || id;
  const esJugadora = pregunta.tipo === "jugadora";

  const guardar = async () => {
    setSaving(true); setMsg("");
    try {
      await onGuardar(pregunta.id, borrador);
      setMsg("✅");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg(`⚠ ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const puntosGanados = resultadoIds
    ? borrador.filter(id => resultadoIds.includes(id)).length * (pregunta.puntos_por_acierto || 0)
    : null;

  return (
    <div style={{ background: "var(--fx-card)", border: "1px solid var(--fx-border)", borderRadius: "12px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fx-text)" }}>{pregunta.titulo}</div>
          <div style={{ fontSize: "10px", color: "var(--fx-muted2)", marginTop: "2px" }}>{pregunta.puntos_por_acierto} pts si aciertas</div>
        </div>
        {resultadoIds && (
          <div style={{ fontSize: "16px", fontWeight: 800, color: puntosGanados > 0 ? "#16a34a" : "var(--fx-muted)" }}>+{puntosGanados}</div>
        )}
      </div>

      {opciones === null ? (
        <input
          type="text"
          value={borrador[0] || ""}
          onChange={e => setBorrador(e.target.value ? [e.target.value] : [])}
          disabled={disabled}
          placeholder="Respuesta"
          style={{ width: "100%", background: "var(--fx-card)", color: "var(--fx-text)", border: "1px solid var(--fx-border)", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
        />
      ) : esJugadora ? (
        <JugadoraSelect opciones={opciones} value={borrador[0]} onChange={v => setBorrador(v ? [v] : [])} disabled={disabled} placeholder="Selecciona jugadora" />
      ) : (
        <EquipoSelect opciones={opciones} value={borrador[0]} onChange={v => setBorrador(v ? [v] : [])} disabled={disabled} placeholder="Elige equipo…" />
      )}

      {resultadoIds && (
        <div style={{ fontSize: "10px", color: "var(--fx-muted2)" }}>
          Real: <b>{resultadoIds.map(id => esJugadora ? nombreJugadora(id) : (opciones ? nombreEquipo(id) : id)).join(", ")}</b>
        </div>
      )}

      {!disabled && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
          {msg && <span style={{ fontSize: "11px", color: msg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
          <button
            onClick={guardar}
            disabled={saving || !cambio || borrador.length === 0}
            style={{
              background: "#9333ea", color: "#fff", border: "none",
              borderRadius: "8px", padding: "5px 12px", fontWeight: 700, fontSize: "11px",
              cursor: (saving || !cambio || borrador.length === 0) ? "default" : "pointer",
              opacity: (saving || !cambio || borrador.length === 0) ? 0.4 : 1,
            }}>
            {saving ? "…" : cambio ? "Guardar" : "Guardado"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Card de fase ────────────────────────────────────────────
function FaseCard({ fase, opcionesPorSource, misPredsByPid, resultadosByPid, onGuardar, equiposMap, gruposEquipos, jugadorasMap }) {
  const estado = estadoFase(fase, resultadosByPid);
  const badge = BADGE[estado];
  const countdown = useCountdown(new Date(fase.fecha_cierre).getTime());
  const disabled = estado !== "abierta";

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

      <div style={{ padding: "14px" }}>
        {estado === "bloqueada" ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--fx-muted2)", fontSize: "13px" }}>
            Esta fase se desbloquea cuando termine la anterior.
          </div>
        ) : fase.fase === "regular" ? (
          // ─── Layout especial: grid de grupos ordenables ────
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {["A", "B", "C", "D"].map(g => (
              <GrupoCard
                key={g}
                grupo={g}
                equiposGrupo={gruposEquipos[g] || []}
                misPredsByPid={misPredsByPid}
                resultadosByPid={resultadosByPid}
                disabled={disabled}
                onGuardar={onGuardar}
              />
            ))}
          </div>
        ) : (
          // ─── Layout genérico: preguntas simples en grid ────
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
            {(fase.preguntas || []).map(q => (
              <PreguntaSimple
                key={q.id}
                pregunta={q}
                opcionesPorSource={opcionesPorSource}
                misIds={misPredsByPid[q.id]}
                resultadoIds={resultadosByPid[q.id]}
                disabled={disabled}
                onGuardar={onGuardar}
                equiposMap={equiposMap}
                jugadorasMap={jugadorasMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ranking ──────────────────────────────────────────────────
function Ranking({ user, onAbrirPerfil }) {
  const [rows, setRows] = useState(null);
  const [perfilMap, setPerfilMap] = useState({});
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("euroliga_ranking", { p_temporada: TEMPORADA });
      if (error) { setRows([]); return; }
      const list = data || [];
      setRows(list);
      const ids = list.map(r => r.user_id);
      if (ids.length) {
        const { data: perfiles } = await supabase.from("perfiles")
          .select("id, alias, avatar, avatar_url, nombre")
          .in("id", ids);
        const m = {}; (perfiles || []).forEach(p => { m[p.id] = p; });
        setPerfilMap(m);
      }
    })();
  }, []);
  if (!rows) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "20px", textAlign: "center", color: "var(--fx-muted)", fontSize: "13px" }}>
      Cargando ranking…
    </div>
  );
  if (rows.length === 0) return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "20px", textAlign: "center", color: "var(--fx-muted)", fontSize: "13px" }}>
      Aún nadie tiene puntos. Empieza a predecir para aparecer aquí.
    </div>
  );
  const medalla = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
  return (
    <div style={{ background: "var(--fx-card)", borderRadius: "14px", padding: "14px 16px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 800, color: "var(--fx-text)", display: "flex", alignItems: "center", gap: "6px" }}>
        <span>🏆 Ranking Quiniela Euroliga</span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--fx-muted2)" }}>({rows.length})</span>
      </h3>
      {rows.slice(0, 50).map((r, i) => {
        const p = perfilMap[r.user_id];
        const nombre = p?.alias || p?.nombre || (r.user_id === user?.id ? "Tú" : "—");
        const yo = r.user_id === user?.id;
        const clickable = onAbrirPerfil && p?.alias;
        return (
          <div key={r.user_id} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "7px 4px", borderTop: i > 0 ? "1px solid var(--fx-border2)" : "none",
            background: yo ? "rgba(147,51,234,0.06)" : "transparent",
            borderRadius: yo ? "6px" : 0,
          }}>
            <span style={{ fontSize: "13px", fontWeight: 800, minWidth: "28px", color: i < 3 ? "var(--fx-text)" : "var(--fx-muted)" }}>{medalla(i)}</span>
            {p?.avatar_url
              ? <img loading="lazy" decoding="async" src={p.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--fx-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{p?.avatar || "👤"}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                onClick={clickable ? () => onAbrirPerfil(p.alias) : undefined}
                style={{
                  fontSize: "13px", fontWeight: yo ? 800 : 600, color: "var(--fx-text)",
                  cursor: clickable ? "pointer" : "default",
                  textDecoration: clickable ? "underline" : "none",
                  textDecorationColor: "#c084fc", textUnderlineOffset: "3px",
                }}>
                {nombre}
              </span>
              {yo && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#9333ea", fontWeight: 700 }}>· TÚ</span>}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#9333ea" }}>{r.total_pts} pts</div>
          </div>
        );
      })}
    </div>
  );
}

export default function EuroligaView({ user, equipos = [], onAbrirPerfil }) {
  const [config, setConfig] = useState(null);
  const [misPreds, setMisPreds] = useState({});
  const [resultados, setResultados] = useState({});
  const [gruposEquipos, setGruposEquipos] = useState({});
  const [jugadorasEL, setJugadorasEL] = useState([]); // roster Euroliga 2026-27
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
      const [cfg, res, parts, temps] = await Promise.all([
        supabase.from("euroliga_config").select("*").eq("temporada", TEMPORADA).order("orden"),
        supabase.from("euroliga_resultados").select("pregunta_id, ids").eq("temporada", TEMPORADA),
        supabase.from("partidos").select("id_equipo_local, id_equipo_visitante, notas")
          .eq("id_liga", ID_LIGA).eq("temporada", TEMPORADA).like("notas", "Temporada regular%"),
        supabase.from("temporadas")
          .select("id_jugadora, id_equipo, jugadoras(nombre, fecha_nac, foto)")
          .eq("id_liga", ID_LIGA).eq("temporada", TEMPORADA),
      ]);
      if (cancel) return;
      if (cfg.error) { setErr(cfg.error.message); setLoading(false); return; }
      setConfig(cfg.data || []);
      const r = {}; (res.data || []).forEach(x => { r[x.pregunta_id] = x.ids; });
      setResultados(r);
      const gru = { A: new Set(), B: new Set(), C: new Set(), D: new Set() };
      (parts.data || []).forEach(p => {
        const m = /Grupo (.)/.exec(p.notas || "");
        if (!m || !gru[m[1]]) return;
        if (p.id_equipo_local) gru[m[1]].add(p.id_equipo_local);
        if (p.id_equipo_visitante) gru[m[1]].add(p.id_equipo_visitante);
      });
      const gruObj = {};
      Object.keys(gru).forEach(k => {
        gruObj[k] = [...gru[k]]
          .map(id => equiposMap[id])
          .filter(Boolean)
          .map(e => ({ id: e.id_equipo, nombre: e.nombre, escudo: e.escudo }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      });
      setGruposEquipos(gruObj);

      // Roster Euroliga 2026-27 con equipo y fecha_nac
      const jugadoras = (temps.data || [])
        .map(t => {
          const eq = equiposMap[t.id_equipo];
          return {
            id: t.id_jugadora,
            nombre: t.jugadoras?.nombre || t.id_jugadora,
            foto: t.jugadoras?.foto || null,
            fecha_nac: t.jugadoras?.fecha_nac || null,
            id_equipo: t.id_equipo,
            equipoNombre: eq?.nombre || t.id_equipo,
            equipoEscudo: eq?.escudo || null,
          };
        })
        // Dedupe por id_jugadora por si aparece en más de una entrada
        .reduce((acc, j) => (acc.find(x => x.id === j.id) ? acc : [...acc, j]), [])
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setJugadorasEL(jugadoras);

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
  }, [user?.id, equiposMap]);

  const opcionesPorSource = useMemo(() => {
    const out = {};
    ["A", "B", "C", "D"].forEach(g => { out[`grupo_${g}_2026_27`] = gruposEquipos[g] || []; });
    const todos = new Map();
    Object.values(gruposEquipos).forEach(arr => arr.forEach(e => todos.set(e.id, e)));
    out["euroliga_2026_27"] = [...todos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    // Jugadoras: todas y filtro sub-22 (nacidas en 2004-01-01 o después)
    out["jugadoras_L004_2026_27"] = jugadorasEL;
    const CORTE_JOVEN = "2004-01-01";
    out["jovenes_L004_2026_27"] = jugadorasEL.filter(j => j.fecha_nac && j.fecha_nac >= CORTE_JOVEN);
    out["grupo_E_2026_27"] = [];
    out["grupo_F_2026_27"] = [];
    out["playins_2026_27"] = [];
    out["f6_2026_27"] = [];
    return out;
  }, [gruposEquipos, jugadorasEL]);

  // Mapa id_jugadora -> {nombre, foto, ...} para pintar el resultado real
  const jugadorasMap = useMemo(() => {
    const m = {};
    jugadorasEL.forEach(j => { m[j.id] = j; });
    return m;
  }, [jugadorasEL]);

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
    <FasesTabs
      config={config || []}
      opcionesPorSource={opcionesPorSource}
      misPreds={misPreds}
      resultados={resultados}
      onGuardar={onGuardar}
      equiposMap={equiposMap}
      gruposEquipos={gruposEquipos}
      jugadorasMap={jugadorasMap}
      user={user}
      onAbrirPerfil={onAbrirPerfil}
    />
  );
}

// ─── Contenedor con pestañas por fase ────────────────────────
function FasesTabs({ config, opcionesPorSource, misPreds, resultados, onGuardar, equiposMap, gruposEquipos, jugadorasMap, user, onAbrirPerfil }) {
  // Fase inicial: la primera abierta; si ninguna, la primera de la lista.
  const primera = useMemo(() => {
    if (!config.length) return null;
    const abierta = config.find(f => estadoFase(f, resultados) === "abierta");
    return (abierta || config[0]).fase;
  }, [config, resultados]);
  const [activa, setActiva] = useState(primera);
  useEffect(() => { setActiva(primera); }, [primera]);

  const faseActiva = config.find(f => f.fase === activa);
  const enRanking = activa === "__ranking__";

  return (
    <div>
      <div style={{
        display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap",
        overflowX: "auto", paddingBottom: "4px",
      }}>
        {config.map(f => {
          const est = estadoFase(f, resultados);
          const activo = f.fase === activa;
          return (
            <button
              key={f.fase}
              onClick={() => setActiva(f.fase)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: activo ? "#9333ea" : "var(--fx-card)",
                color: activo ? "#fff" : "var(--fx-label)",
                border: `1.5px solid ${activo ? "#7c3aed" : "var(--fx-border)"}`,
                borderRadius: "20px", padding: "7px 14px",
                fontWeight: 700, fontSize: "12px", cursor: "pointer",
                whiteSpace: "nowrap",
              }}>
              <span>{BADGE[est].emo}</span>
              <span>{f.titulo.split("·")[0].trim()}</span>
            </button>
          );
        })}
        <button
          onClick={() => setActiva("__ranking__")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: enRanking ? "#9333ea" : "var(--fx-card)",
            color: enRanking ? "#fff" : "var(--fx-label)",
            border: `1.5px solid ${enRanking ? "#7c3aed" : "var(--fx-border)"}`,
            borderRadius: "20px", padding: "7px 14px",
            fontWeight: 700, fontSize: "12px", cursor: "pointer",
            whiteSpace: "nowrap", marginLeft: "auto",
          }}>
          <span>🏆</span><span>Ranking</span>
        </button>
      </div>

      {enRanking ? (
        <Ranking user={user} onAbrirPerfil={onAbrirPerfil} />
      ) : faseActiva ? (
        <FaseCard
          fase={faseActiva}
          opcionesPorSource={opcionesPorSource}
          misPredsByPid={misPreds}
          resultadosByPid={resultados}
          onGuardar={onGuardar}
          equiposMap={equiposMap}
          gruposEquipos={gruposEquipos}
          jugadorasMap={jugadorasMap}
        />
      ) : null}
    </div>
  );
}
