import fs from "node:fs/promises";
import path from "node:path";

const SITE = "https://labasketneta.app";
const URL = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_KEY;

if (!URL || !KEY) {
  console.warn("[sitemap] Falta REACT_APP_SUPABASE_URL o REACT_APP_SUPABASE_KEY. Genero solo URLs base.");
}

async function fetchAllIds(table, idCol) {
  if (!URL || !KEY) return [];
  const ids = [];
  const step = 1000;
  let from = 0;
  while (true) {
    const to = from + step - 1;
    const res = await fetch(`${URL}/rest/v1/${table}?select=${idCol}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${to}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) {
      console.warn(`[sitemap] ${table} range ${from}-${to}: ${res.status}`);
      break;
    }
    const rows = await res.json();
    if (!rows.length) break;
    rows.forEach(r => ids.push(r[idCol]));
    if (rows.length < step) break;
    from += step;
  }
  return ids;
}

function urlEntry(loc, priority = "0.5") {
  return `  <url><loc>${loc}</loc><priority>${priority}</priority></url>`;
}

const tabs = ["", "jugadoras", "equipos", "ligas", "coaches", "ranking_fiba", "partidos", "comparar", "quiniela", "privacidad"];

const [jugs, eqs, ligas] = await Promise.all([
  fetchAllIds("jugadoras", "id_jugadora"),
  fetchAllIds("equipos", "id_equipo"),
  fetchAllIds("ligas", "id_liga"),
]);

console.log(`[sitemap] ${jugs.length} jugadoras, ${eqs.length} equipos, ${ligas.length} ligas`);

const urls = [
  ...tabs.map(t => urlEntry(`${SITE}/${t}`, t === "" ? "1.0" : "0.7")),
  ...jugs.map(id => urlEntry(`${SITE}/jugadoras/${id}`, "0.6")),
  ...eqs.map(id => urlEntry(`${SITE}/equipos/${id}`, "0.6")),
  ...ligas.map(id => urlEntry(`${SITE}/ligas/${id}`, "0.6")),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

const out = path.resolve("public/sitemap.xml");
await fs.writeFile(out, xml, "utf8");
console.log(`[sitemap] ${urls.length} URLs -> ${out}`);

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
await fs.writeFile(path.resolve("public/robots.txt"), robots, "utf8");
console.log(`[sitemap] robots.txt actualizado`);
