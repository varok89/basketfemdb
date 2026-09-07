// Agregador de estado: UptimeRobot + Healthchecks + Backblaze B2 + Vercel + visitas Supabase.
// Solo endpoint server-side: las API keys nunca llegan al cliente.
const { createClient } = require("@supabase/supabase-js");

async function uptimerobot() {
  const key = process.env.UPTIMEROBOT_API_KEY;
  if (!key) return { error: "missing UPTIMEROBOT_API_KEY" };
  const body = new URLSearchParams({
    api_key: key, format: "json", logs: "1", logs_limit: "3",
    custom_uptime_ratios: "1-7-30", response_times: "1", response_times_limit: "1"
  });
  const r = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
  });
  const j = await r.json();
  if (j.stat !== "ok") return { error: j.error?.message || "uptimerobot error" };
  return {
    monitors: (j.monitors || []).map(m => ({
      name: m.friendly_name, url: m.url,
      status: m.status, // 2 = up, 9 = down, 8 = seems down, 0 = paused
      uptime: (m.custom_uptime_ratio || "").split("-"), // [1d, 7d, 30d]
      response_ms: m.average_response_time ? Math.round(m.average_response_time) : null,
      last_log: (m.logs || [])[0] ? {
        type: m.logs[0].type, // 1=down, 2=up
        datetime: m.logs[0].datetime,
        reason: m.logs[0].reason?.detail || null
      } : null
    }))
  };
}

async function healthchecks() {
  const key = process.env.HEALTHCHECKS_API_KEY;
  if (!key) return { error: "missing HEALTHCHECKS_API_KEY" };
  const r = await fetch("https://healthchecks.io/api/v3/checks/", { headers: { "X-Api-Key": key } });
  const j = await r.json();
  if (!j.checks) return { error: j.error || "healthchecks error" };
  return {
    checks: j.checks.map(c => ({
      name: c.name, status: c.status, // up/down/late/new/paused
      last_ping: c.last_ping, next_ping: c.next_ping, schedule: c.schedule
    }))
  };
}

async function backblaze() {
  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const bucketId = process.env.B2_BUCKET_ID || "ead05dbbc37d71a9a4000112";
  if (!keyId || !appKey) return { error: "missing B2_KEY_ID / B2_APP_KEY" };
  const auth = Buffer.from(`${keyId}:${appKey}`).toString("base64");
  const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${auth}` }
  });
  const authJ = await authRes.json();
  if (!authJ.apiInfo?.storageApi) return { error: authJ.message || "B2 auth failed" };
  const { apiUrl } = authJ.apiInfo.storageApi;
  const token = authJ.authorizationToken;
  const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
    method: "POST", headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId, maxFileCount: 100 })
  });
  const listJ = await listRes.json();
  if (!listJ.files) return { error: listJ.message || "B2 list failed" };
  const files = listJ.files
    .map(f => ({ name: f.fileName, size: f.contentLength, ts: f.uploadTimestamp }))
    .sort((a, b) => b.ts - a.ts);
  return {
    total: files.length,
    last: files[0] || null,
    total_size: files.reduce((a, f) => a + (f.size || 0), 0)
  };
}

async function vercel() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { error: "missing VERCEL_TOKEN / VERCEL_PROJECT_ID" };
  const headers = { Authorization: `Bearer ${token}` };
  const dRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=5`, { headers });
  const dJ = await dRes.json();
  if (!dJ.deployments) return { error: dJ.error?.message || "vercel error" };
  return {
    deploys: dJ.deployments.map(d => ({
      state: d.state, // READY / ERROR / BUILDING / QUEUED / CANCELED
      created: d.created, url: d.url,
      commit: d.meta?.githubCommitMessage?.slice(0, 80) || null,
      target: d.target
    }))
  };
}

async function visitas() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) return { error: "missing SUPABASE_URL/KEY" };
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const ahora = new Date();
  const h24 = new Date(ahora - 24 * 3600 * 1000).toISOString();
  const d7 = new Date(ahora - 7 * 24 * 3600 * 1000).toISOString();
  const [{ count: c24 }, { count: c7 }] = await Promise.all([
    sb.from("visitas").select("id", { count: "exact", head: true }).gte("created_at", h24),
    sb.from("visitas").select("id", { count: "exact", head: true }).gte("created_at", d7)
  ]);
  return { visitas_24h: c24 ?? 0, visitas_7d: c7 ?? 0 };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const [up, hc, b2, vc, vi] = await Promise.all([
      uptimerobot().catch(e => ({ error: e.message })),
      healthchecks().catch(e => ({ error: e.message })),
      backblaze().catch(e => ({ error: e.message })),
      vercel().catch(e => ({ error: e.message })),
      visitas().catch(e => ({ error: e.message }))
    ]);
    res.status(200).json({ uptime: up, cron: hc, backup: b2, vercel: vc, app: vi, ts: Date.now() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
