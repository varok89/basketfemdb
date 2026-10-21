// monitor-ui v1 — página HTML standalone con estado tipo Nagios.
// URL: https://<project>.supabase.co/functions/v1/monitor-ui?token=<MONITOR_TOKEN>
// Token leído de app_meta.monitor_token (requiere service_role, no expuesto por RLS).
// Autorefresh cada 30s. Funciona aunque Vercel/frontend esté caído, siempre que Supabase viva.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);

const COLOR: Record<string, string> = {
  ok: "#16a34a", warn: "#eab308", crit: "#dc2626", disabled: "#64748b", unknown: "#94a3b8",
};
const LABEL: Record<string, string> = {
  ok: "OK", warn: "WARN", crit: "CRIT", disabled: "OFF", unknown: "?",
};

function fmtAge(iso: string | null): string {
  if (!iso) return "—";
  const d = Date.now() - new Date(iso).getTime();
  if (d < 0) return "—";
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Row {
  categoria: string; servicio_id: string; servicio: string; host: string;
  status: string; last_check: string | null; duracion_s: number | null; info: string;
}

function renderTable(rows: Row[], titulo: string): string {
  if (rows.length === 0) return "";
  return `
<h2 style="margin:24px 0 8px;font-size:14px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${escapeHtml(titulo)} (${rows.length})</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead>
    <tr style="color:#64748b;font-size:11px;text-align:left;border-bottom:1px solid #334155">
      <th style="padding:6px 10px">Estado</th>
      <th style="padding:6px 10px">Servicio</th>
      <th style="padding:6px 10px">Host</th>
      <th style="padding:6px 10px">Último</th>
      <th style="padding:6px 10px">Dur</th>
      <th style="padding:6px 10px;width:100%">Info</th>
    </tr>
  </thead>
  <tbody>
${rows.map(r => `
    <tr style="border-bottom:1px solid #1e293b">
      <td style="padding:8px 10px;white-space:nowrap"><span style="display:inline-block;background:${COLOR[r.status] || "#64748b"};color:#fff;font-weight:800;padding:2px 8px;border-radius:4px;font-size:11px">${LABEL[r.status] || r.status}</span></td>
      <td style="padding:8px 10px;font-weight:600">${escapeHtml(r.servicio)}</td>
      <td style="padding:8px 10px;color:#94a3b8">${escapeHtml(r.host)}</td>
      <td style="padding:8px 10px;color:#94a3b8;white-space:nowrap">${fmtAge(r.last_check)}</td>
      <td style="padding:8px 10px;color:#94a3b8;white-space:nowrap">${r.duracion_s != null ? r.duracion_s + "s" : "—"}</td>
      <td style="padding:8px 10px;color:#cbd5e1;font-size:12px">${escapeHtml(r.info)}</td>
    </tr>`).join("")}
  </tbody>
</table>`;
}

function renderHtml(rows: Row[]): string {
  const byCat: Record<string, Row[]> = {};
  for (const r of rows) (byCat[r.categoria] ||= []).push(r);

  const totals = { ok: 0, warn: 0, crit: 0, disabled: 0, unknown: 0 };
  for (const r of rows) {
    const s = r.status as keyof typeof totals;
    if (totals[s] !== undefined) totals[s]++;
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const sortByStatus = (a: Row, b: Row) => {
    const order: Record<string, number> = { crit: 0, warn: 1, disabled: 2, unknown: 3, ok: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.servicio.localeCompare(b.servicio);
  };

  const titulos: Record<string, string> = { cron: "Crons", liga: "Ligas automatizadas", bd: "Base de datos" };
  const seccionesHtml = Object.entries(byCat)
    .map(([cat, lista]) => renderTable([...lista].sort(sortByStatus), titulos[cat] || cat))
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>🩺 Monitor · LaBasketneta</title>
<style>
body{margin:0;padding:16px;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
h1{margin:0 0 4px;font-size:20px;font-weight:800}
.sub{color:#64748b;font-size:12px;margin-bottom:16px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.badge{padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#fff}
table{background:#1e293b;border-radius:8px;overflow:hidden}
</style>
</head>
<body>
<h1>🩺 Monitor de salud</h1>
<div class="sub">${rows.length} servicios · comprobado ${now} UTC · autorefresh 30s</div>
<div class="badges">
  <span class="badge" style="background:${COLOR.crit}">CRIT ${totals.crit}</span>
  <span class="badge" style="background:${COLOR.warn}">WARN ${totals.warn}</span>
  <span class="badge" style="background:${COLOR.ok}">OK ${totals.ok}</span>
  ${totals.disabled ? `<span class="badge" style="background:${COLOR.disabled}">OFF ${totals.disabled}</span>` : ""}
  ${totals.unknown ? `<span class="badge" style="background:${COLOR.unknown}">? ${totals.unknown}</span>` : ""}
</div>
${seccionesHtml}
</body>
</html>`;
}

Deno.serve(async (req) => {
  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    const { data: tokenRow } = await sb.from("app_meta").select("value").eq("key", "monitor_token").maybeSingle();
    const expected = tokenRow?.value || "";
    if (!expected || token !== expected) {
      return html("<h1>401</h1><p>Token inválido</p>", 401);
    }

    const { data, error } = await sb.rpc("monitor_servicios");
    if (error) return html(`<h1>Error</h1><pre>${escapeHtml(error.message)}</pre>`, 500);

    return html(renderHtml((data as Row[]) || []));
  } catch (e) {
    return html(`<h1>Error</h1><pre>${escapeHtml(String(e))}</pre>`, 500);
  }
});
