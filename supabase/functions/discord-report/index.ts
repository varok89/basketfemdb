// discord-report v1
// Recibe slash commands /reportar de Discord y crea card en Notion.
// - Verifica firma Ed25519 con la Public Key de la app Discord.
// - Body del comando: /reportar descripcion:<texto libre>
// - Crea card en el DB "🎯 Backlog & Bugs" con tipo=Bug, prioridad=🟢 Baja.
// - Responde en Discord con link a la card creada.
//
// Env vars requeridas:
//   NOTION_TOKEN       (ya usado por sentry-webhook)
//   NOTION_DB_ID       (idem)
// Nota: DISCORD_PUBLIC_KEY es pública, hardcoded abajo.
// El Bot Token no se necesita en esta función; solo para registrar el comando.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nacl from "npm:tweetnacl@1.0.3";

const DISCORD_PUBLIC_KEY = "5b1cf8cb5bd3345a02d462bde7c6386690e40096941fe28d46309ebd669b9476";
const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const NOTION_DB_ID = Deno.env.get("NOTION_DB_ID")!;
const NOTION_VERSION = "2022-06-28";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function verifyDiscordSignature(signature: string, timestamp: string, body: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToBytes(signature),
      hexToBytes(DISCORD_PUBLIC_KEY),
    );
  } catch {
    return false;
  }
}

async function crearCardNotion(descripcion: string, autor: string, canal: string): Promise<{ id: string }> {
  const body = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      "Título": { title: [{ text: { content: `[Discord] ${descripcion.slice(0, 180)}` } }] },
      "Tipo": { select: { name: "Bug" } },
      "Prioridad": { select: { name: "🟢 Baja" } },
      "Estado": { status: { name: "Not started" } },
      "Reportado por": { rich_text: [{ text: { content: autor } }] },
    },
    children: [
      {
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: descripcion } }] },
      },
    ],
  };
  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`notion ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature-Ed25519") || "";
  const timestamp = req.headers.get("X-Signature-Timestamp") || "";

  if (!verifyDiscordSignature(signature, timestamp, rawBody)) {
    return new Response("Invalid request signature", { status: 401 });
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // PING para verificación Discord
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  // APPLICATION_COMMAND
  if (interaction.type === 2) {
    const cmd = interaction.data?.name;
    if (cmd !== "reportar") {
      return Response.json({ type: 4, data: { content: "Comando desconocido", flags: 64 } });
    }

    const descripcion = String(interaction.data?.options?.[0]?.value || "").trim();
    const autor = interaction.member?.user?.username || interaction.user?.username || "?";
    const canal = interaction.channel_id || "?";

    if (!descripcion) {
      return Response.json({ type: 4, data: { content: "❌ Falta la descripción.", flags: 64 } });
    }

    try {
      await crearCardNotion(descripcion, autor, canal);
      return Response.json({
        type: 4,
        data: { content: `✅ ¡Gracias! Tu reporte ha sido registrado. Un admin lo revisará pronto.` },
      });
    } catch (e) {
      return Response.json({
        type: 4,
        data: { content: `❌ Error creando reporte: ${(e as Error).message}`, flags: 64 },
      });
    }
  }

  return Response.json({ type: 4, data: { content: "Tipo de interacción no soportado", flags: 64 } });
});
