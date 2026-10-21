// monitor-ui v3 — devuelve JSON con los chequeos de monitor_servicios.
// v2 intentó servir HTML, pero Supabase Edge Runtime sobrescribe Content-Type
// a text/plain / application/json + nosniff para no servir HTML explotable.
// Solución: devolver JSON y que el cliente (pestaña admin React) renderice.
//
// URL: https://<project>.supabase.co/functions/v1/monitor-ui?token=<MONITOR_TOKEN>&apikey=<ANON_KEY>
// Token validado contra app_meta.monitor_token (RLS protegido).
// Si cae Vercel, se puede abrir la URL directa y leer el JSON crudo.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    const { data: tokenRow } = await sb.from("app_meta").select("value").eq("key", "monitor_token").maybeSingle();
    const expected = tokenRow?.value || "";
    if (!expected || token !== expected) return json({ ok: false, error: "token inválido" }, 401);

    const { data, error } = await sb.rpc("monitor_servicios");
    if (error) return json({ ok: false, error: error.message }, 500);

    const rows = data || [];
    const totals = { ok: 0, warn: 0, crit: 0, disabled: 0, unknown: 0 };
    for (const r of rows as any[]) {
      const s = r.status as keyof typeof totals;
      if (totals[s] !== undefined) totals[s]++;
    }
    return json({ ok: true, ts: new Date().toISOString(), totals, servicios: rows });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
