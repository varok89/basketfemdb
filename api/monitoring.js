// Sentry tunnel: proxy hacia Sentry para evitar adblockers.
// Docs: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
//
// El frontend envia envelopes a /api/monitoring en vez de directo a *.sentry.io,
// asi los adblockers no bloquean por el hostname.

const SENTRY_HOST = "o4512051062374400.ingest.de.sentry.io";
const KNOWN_PROJECT_IDS = ["4512051072204880"];

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf8");
    const firstLine = body.split("\n", 1)[0];
    const header = JSON.parse(firstLine);
    const dsn = new URL(header.dsn);
    if (dsn.hostname !== SENTRY_HOST) throw new Error("bad host: " + dsn.hostname);
    const projectId = dsn.pathname.replace(/^\//, "");
    if (!KNOWN_PROJECT_IDS.includes(projectId)) throw new Error("bad project: " + projectId);
    const upstream = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;
    const r = await fetch(upstream, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-sentry-envelope" },
    });
    res.status(r.status).send(await r.text());
  } catch (e) {
    // No devolvemos el mensaje al cliente para no dar info a un atacante.
    console.error("[sentry-tunnel]", e.message);
    res.status(400).send("bad envelope");
  }
}
