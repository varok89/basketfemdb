const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    res.status(500).json({ error: "Missing env" }); return;
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const path = String(body.path || "").slice(0, 500);
  const session_id = String(body.session_id || "").slice(0, 100);
  if (!path || !session_id) { res.status(400).json({ error: "path + session_id required" }); return; }
  const referrer = body.referrer ? String(body.referrer).slice(0, 2000) : null;
  const id_usuario = body.id_usuario || null;
  const ua = String(req.headers["user-agent"] || "").slice(0, 500) || null;
  const pais = String(req.headers["x-vercel-ip-country"] || "").slice(0, 4).toUpperCase() || null;
  const ciudad = req.headers["x-vercel-ip-city"] ? decodeURIComponent(req.headers["x-vercel-ip-city"]) : null;
  const row = { path, referrer, user_agent: ua, pais, session_id, id_usuario };
  if (ciudad) row.ciudad = String(ciudad).slice(0, 100);
  const { error } = await supabase.from("visitas").insert(row);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).end();
};
