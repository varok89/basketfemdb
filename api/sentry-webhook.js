// api/sentry-webhook.js
// Recibe alertas de Sentry (legacy webhook alert rule) y crea una tarjeta
// en el DB "🎯 Backlog & Bugs" de Notion.
//
// Auth: query param ?secret=... comparado con SENTRY_WEBHOOK_SECRET.
// Dedup: prefijamos el título con `[SNT-{issue_id}]` y buscamos por ese
// prefijo antes de crear. Si ya existe, no crea nada (200 idempotente).
//
// Env vars requeridas:
//   NOTION_TOKEN            (ntn_... del Internal Integration)
//   NOTION_DB_ID            (31cfccd6-a32f-4602-a0b0-4911c2afcca6)
//   SENTRY_WEBHOOK_SECRET   (cadena aleatoria que también se pega en la URL de Sentry)

const NOTION_VERSION = "2022-06-28";

function priorityFromLevel(level) {
  const l = String(level || "").toLowerCase();
  if (l === "fatal" || l === "error") return "🔴 Alta";
  if (l === "warning") return "🟡 Media";
  return "🟢 Baja";
}

async function notionSearchByPrefix(prefix) {
  const r = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "Título", title: { starts_with: prefix } },
      page_size: 1,
    }),
  });
  if (!r.ok) throw new Error(`notion query ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.results?.[0] || null;
}

async function notionCreatePage({ title, level, url, culprit, project, environment, stackHead }) {
  const body = {
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: {
      "Título":    { title: [{ text: { content: title.slice(0, 200) } }] },
      "Tipo":      { select: { name: "Bug" } },
      "Prioridad": { select: { name: priorityFromLevel(level) } },
      "Área":      { multi_select: [{ name: "Frontend" }] },
      "Estado":    { status: { name: "Not started" } },
    },
    children: [
      {
        object: "block", type: "paragraph",
        paragraph: { rich_text: [
          { type: "text", text: { content: `Sentry level: ${level || "?"} · project: ${project || "?"} · env: ${environment || "?"}` } },
        ]},
      },
      culprit ? {
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: `Culprit: ${culprit}` } }] },
      } : null,
      url ? {
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: "Ver en Sentry: " } },
                                 { type: "text", text: { content: url, link: { url } } }] },
      } : null,
      stackHead ? {
        object: "block", type: "code",
        code: { language: "plain text", rich_text: [{ type: "text", text: { content: stackHead.slice(0, 1900) } }] },
      } : null,
    ].filter(Boolean),
  };
  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`notion create ${r.status}: ${await r.text()}`);
  return await r.json();
}

// Normaliza el payload de Sentry. Legacy webhook manda campos planos,
// Internal Integration manda { action, data: { event: {...} } }.
function normalize(body) {
  const ev = body?.data?.event || body?.event || body || {};
  const issueId = String(body?.data?.event?.issue_id
    || body?.event?.issue_id
    || body?.id
    || body?.issue_id
    || ev.issue_id
    || ev.id
    || "");
  const title = ev.title || ev.message || body?.message || body?.title || "Sentry issue";
  const level = ev.level || body?.level || "error";
  const project = ev.project_slug || body?.project_slug || body?.project || body?.project_name || "";
  const environment = ev.environment || body?.environment || "";
  const culprit = ev.culprit || body?.culprit || "";
  const url = ev.web_url || ev.url || body?.web_url || body?.url || "";
  let stackHead = "";
  const entries = ev.entries || [];
  for (const e of entries) {
    if (e.type === "exception") {
      const frames = e.data?.values?.[0]?.stacktrace?.frames || [];
      const top = frames.slice(-5).reverse();
      stackHead = top.map(f => `at ${f.function || "?"} (${f.filename || "?"}:${f.lineno || "?"})`).join("\n");
      break;
    }
  }
  return { issueId, title, level, project, environment, culprit, url, stackHead };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
  const providedSecret = req.query?.secret || req.headers["x-webhook-secret"];
  if (!process.env.SENTRY_WEBHOOK_SECRET || providedSecret !== process.env.SENTRY_WEBHOOK_SECRET) {
    res.status(401).send("unauthorized"); return;
  }
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
    res.status(500).json({ error: "missing NOTION_TOKEN or NOTION_DB_ID" }); return;
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
  if (!body || typeof body !== "object") { res.status(400).json({ error: "invalid body" }); return; }

  try {
    const n = normalize(body);
    const prefix = n.issueId ? `[SNT-${n.issueId}] ` : "[SNT] ";
    const title = prefix + (n.title || "Sentry issue");

    if (n.issueId) {
      const existing = await notionSearchByPrefix(prefix);
      if (existing) { res.status(200).json({ ok: true, dedup: true, page_id: existing.id }); return; }
    }
    const page = await notionCreatePage({ ...n, title });
    res.status(200).json({ ok: true, created: true, page_id: page.id });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
