// genius-inspeccionar v1
// Herramienta admin: consulta Genius Sports para descubrir competiciones
// y equipos de una federación. Permite al usuario ver qué hay disponible
// ANTES de configurar el scraper de calendario.
//
// POST body:
//   { org: "WBBL" }                    → lista competiciones disponibles
//   { org: "WBBL", comp_id: 12345 }    → lista equipos de esa competición

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.text();
  } catch { return null; }
}

interface CompRef { comp_id: number; nombre: string; }
interface EquipoRef { id_genius: number; nombre: string; logo: string | null; }

function extraerCompeticiones(html: string): { fed: string; comps: CompRef[] } {
  const fed = /<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1]?.trim() || "";
  const comps: CompRef[] = [];
  const rx = /competition\/(\d+)\/schedule"[^>]*>([^<]+)</g;
  let m;
  const seen = new Set<string>();
  while ((m = rx.exec(html)) !== null) {
    const key = `${m[1]}|${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    comps.push({ comp_id: parseInt(m[1], 10), nombre: m[2].trim() });
  }
  return { fed, comps };
}

function extraerEquipos(html: string): { fed: string; comp: string; equipos: EquipoRef[] } {
  const fed = /<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1]?.trim() || "";
  const comp = /<h3[^>]*>([^<]+)<\/h3>/.exec(html)?.[1]?.trim() || "";
  const equipos: EquipoRef[] = [];
  const seen = new Set<number>();
  const rx = /team\/(\d+)\?"[\s\S]{0,400}?<img\s+src\s*=\s*"([^"]+)"\s+alt="([^"]+)"/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const id = parseInt(m[1], 10);
    if (seen.has(id)) continue;
    seen.add(id);
    equipos.push({
      id_genius: id,
      nombre: m[3].replace(/&amp;/g, "&").trim(),
      logo: m[2] || null,
    });
  }
  return { fed, comp, equipos: equipos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) };
}

Deno.serve(async (req) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const org = String(body.org || "").trim().toUpperCase();
    if (!org) return json({ ok: false, error: "Falta 'org' (ej. WBBL, KKI, BB, DAM)" }, 400);

    if (body.comp_id) {
      const cid = parseInt(String(body.comp_id), 10);
      if (isNaN(cid)) return json({ ok: false, error: "comp_id inválido" }, 400);
      const url = `https://hosted.dcd.shared.geniussports.com/${org}/en/competition/${cid}/schedule`;
      const html = await fetchHTML(url);
      if (!html) return json({ ok: false, error: "HTTP error al descargar" }, 502);
      const { fed, comp, equipos } = extraerEquipos(html);
      return json({ ok: true, org, comp_id: cid, fed, comp, equipos });
    }

    const url = `https://hosted.dcd.shared.geniussports.com/${org}/en/schedule`;
    const html = await fetchHTML(url);
    if (!html) return json({ ok: false, error: "HTTP error al descargar" }, 502);
    const { fed, comps } = extraerCompeticiones(html);
    if (!fed && comps.length === 0) return json({ ok: false, error: `Sin datos para org=${org}` }, 404);
    return json({ ok: true, org, fed, competiciones: comps });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
