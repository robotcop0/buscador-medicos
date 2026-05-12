import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { ChatApiResponse, ChatMessage, PendingSelection } from "@/lib/chatbot/types";
import { SYSTEM_PROMPT } from "@/lib/chatbot/system-prompt";
import { CHATBOT_TOOLS, buscarMedicos } from "@/lib/chatbot/tools";

export const runtime = "nodejs";
// Importa data/doctors (grande); no es una ruta estática.
export const dynamic = "force-dynamic";

const CHATBOT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 2048;
const MAX_TOOL_ITERATIONS = 5;
const MAX_CONVERSATION_TURNS = 24;

// Rate-limit best-effort en memoria (se reinicia con el proceso). 20 msgs / 10 min por IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const rateLog = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateLog.set(ip, arr);
  // Limpieza oportunista para no crecer sin límite.
  if (rateLog.size > 5000) {
    for (const [k, v] of rateLog) if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateLog.delete(k);
  }
  return arr.length > RATE_MAX;
}

function json(body: ChatApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

/** Saca el texto plano de un turno de asistente (ignora tool_use). */
function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function parseSelection(toolUse: Anthropic.Messages.ToolUseBlock): PendingSelection {
  const inp = (toolUse.input ?? {}) as {
    pregunta?: string;
    campo?: string;
    opciones?: { label?: string; value?: string }[];
    permite_personalizado?: boolean;
  };
  const opciones = (inp.opciones ?? [])
    .filter((o) => o && typeof o.label === "string" && typeof o.value === "string")
    .map((o) => ({ label: o.label as string, value: o.value as string }));
  return {
    toolUseId: toolUse.id,
    pregunta: inp.pregunta ?? "¿Qué prefieres?",
    campo: inp.campo ?? "",
    opciones,
    permitePersonalizado: !!inp.permite_personalizado,
  };
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { ok: false, error: "El asistente no está disponible ahora mismo. Puedes usar el buscador de arriba." },
      503,
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Has hecho muchas preguntas seguidas. Espera un momento y vuelve a intentarlo." }, 429);
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.messages)) throw new Error("bad body");
    messages = body.messages as ChatMessage[];
  } catch {
    return json({ ok: false, error: "Petición inválida." }, 400);
  }
  if (messages.length === 0) return json({ ok: false, error: "Conversación vacía." }, 400);
  if (messages.length > MAX_CONVERSATION_TURNS) {
    return json(
      { ok: false, error: "Esta conversación se ha hecho muy larga. Pulsa «Reiniciar» y empieza de nuevo, por favor." },
      400,
    );
  }

  const client = new Anthropic({ apiKey });
  // Copia mutable de la conversación para el bucle agéntico.
  let convo: Anthropic.MessageParam[] = [...messages];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: CHATBOT_MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: CHATBOT_TOOLS,
        messages: convo,
      });

      const text = extractText(response.content);
      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      // ¿Pide una selección al usuario? -> pausa el bucle y delega en el cliente.
      const selectionUse = toolUses.find((b) => b.name === "solicitar_seleccion");
      if (selectionUse) {
        return json({
          ok: true,
          assistantText: text,
          assistantContent: response.content as unknown as Anthropic.ContentBlockParam[],
          pendingSelection: parseSelection(selectionUse),
        });
      }

      // ¿Terminó? (sin tool_use, o stop_reason != tool_use)
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        return json({
          ok: true,
          assistantText: text || "Perdona, no he sabido responder a eso. ¿Puedes reformularlo?",
          assistantContent: null,
          pendingSelection: null,
        });
      }

      // Ejecuta las tools de búsqueda y vuelve a llamar.
      convo = [...convo, { role: "assistant", content: response.content }];
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        let out: string;
        if (tu.name === "buscar_medicos") {
          out = await buscarMedicos(tu.input);
        } else {
          out = JSON.stringify({ error: `Herramienta desconocida: ${tu.name}` });
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      convo = [...convo, { role: "user", content: results }];
    }

    // Demasiadas iteraciones de tool.
    return json({
      ok: true,
      assistantText: "Me ha costado demasiado completar la búsqueda. ¿Puedes darme la mutua, la especialidad y el código postal de nuevo?",
      assistantContent: null,
      pendingSelection: null,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ ok: false, error: "El asistente está saturado ahora mismo. Prueba dentro de un minuto." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      return json({ ok: false, error: "El asistente ha tenido un problema. Vuelve a intentarlo en un momento." }, 502);
    }
    return json({ ok: false, error: "Error inesperado en el asistente." }, 500);
  }
}
