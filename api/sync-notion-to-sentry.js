// api/sync-notion-to-sentry.js
// Cada X minutos (cron), lee las tarjetas [SNT-...] del DB Backlog & Bugs
// que estén en Estado="Done" y marca los issues correspondientes como
// resolved en Sentry. Sentry es idempotente — resolver un issue ya
// resuelto es no-op, así que no hace falta llevar un marcador.
//
// Auth: query param ?secret=... comparado con SENTRY_WEBHOOK_SECRET
// (reutilizo el mismo para no multiplicar secretos).
//
// Env vars requeridas:
//   NOTION_TOKEN
//   NOTION_DB_ID
//   SENTRY_WEBHOOK_SECRET
//   SENTRY_API_TOKEN      (Personal Token con scope event:admin)
//   SENTRY_ORG_SLUG       (ej. "labasketneta")

const NOTION_VERSION = "2022-06-28";

async function notionQueryDone() {
  const r = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Título", title: { starts_with: "[SNT-" } },
          { property: "Estado", status: { equals: "Done" } },
        ],
      },
      page_size: 100,
    }),
  });
  if (!r.ok) throw new Error(`notion query ${r.status}: ${await r.text()}`);
  return await r.json();
}

function extractIssueId(page) {
  const t = page.properties?.["Título"]?.title || [];
  const raw = t.map(p => p.plain_text || p.text?.content || "").join("");
  const m = raw.match(/^\[SNT-([^\]]+)\]/);
  return m ? m[1] : null;
}

async function sentryResolve(issueId) {
  const url = `https://sentry.io/api/0/organizations/${process.env.SENTRY_ORG_SLUG}/issues/${encodeURIComponent(issueId)}/`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.SENTRY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "resolved" }),
  });
  if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
  return { ok: true };
}

module.exports = async (req, res) => {
  const providedSecret = req.query?.secret || req.headers["x-webhook-secret"];
  const auth = req.headers["authorization"] || "";
  const isVercelCron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = process.env.SENTRY_WEBHOOK_SECRET && providedSecret === process.env.SENTRY_WEBHOOK_SECRET;
  if (!isVercelCron && !isManual) {
    res.status(401).send("unauthorized"); return;
  }
  const missing = ["NOTION_TOKEN", "NOTION_DB_ID", "SENTRY_API_TOKEN", "SENTRY_ORG_SLUG"]
    .filter(k => !process.env[k]);
  if (missing.length) { res.status(500).json({ error: `missing env: ${missing.join(", ")}` }); return; }

  try {
    const q = await notionQueryDone();
    const pages = q.results || [];
    const out = [];
    for (const p of pages) {
      const issueId = extractIssueId(p);
      if (!issueId) { out.push({ page: p.id, skip: "no_issue_id" }); continue; }
      const r = await sentryResolve(issueId);
      out.push({ page: p.id, issueId, ...r });
    }
    const okCount = out.filter(o => o.ok).length;
    res.status(200).json({ ok: true, checked: pages.length, resolved: okCount, detail: out });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
