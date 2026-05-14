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

// ── Anti-abuso ────────────────────────────────────────────────────────────
// Defensa en capas contra agotar la cuota de Anthropic:
//  1. Cap del body crudo (32 KB) → corta el ataque de "messages" inflados.
//  2. Cap por mensaje (4 KB) y validación de forma → no aceptamos basura.
//  3. Burst per IP (12 / 10 min) → cliente real no se acerca.
//  4. Daily per IP (80 / 24h) → atacante con 1 IP no quema cuota completa.
//  5. Kill-switch global opcional vía env (CHAT_DAILY_GLOBAL_MAX) → tope duro
//     del proceso, off por defecto.
// Todo in-memory: best-effort, se pierde con el restart. Para más rigor habría
// que mover a Redis/Upstash en deploy.
const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_PER_MESSAGE = 4 * 1024;
const RATE_BURST_WINDOW_MS = 10 * 60 * 1000;
const RATE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_BURST_MAX = 12;
const RATE_DAILY_MAX = 80;
const rateLog = new Map<string, number[]>();

let globalDayCount = 0;
let globalDayStart = Date.now();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Devuelve null si OK, o el motivo si está limitado. */
function rateLimited(ip: string): "burst" | "daily" | null {
  const now = Date.now();
  const arr = (rateLog.get(ip) ?? []).filter((t) => now - t < RATE_DAILY_WINDOW_MS);
  arr.push(now);
  rateLog.set(ip, arr);
  if (rateLog.size > 5000) {
    for (const [k, v] of rateLog) if (v.every((t) => now - t >= RATE_DAILY_WINDOW_MS)) rateLog.delete(k);
  }
  if (arr.length > RATE_DAILY_MAX) return "daily";
  const burstCount = arr.reduce((n, t) => (now - t < RATE_BURST_WINDOW_MS ? n + 1 : n), 0);
  if (burstCount > RATE_BURST_MAX) return "burst";
  return null;
}

/** Tope duro del proceso, off si la env no está. */
function globalKillSwitchTripped(): boolean {
  const cap = parseInt(process.env.CHAT_DAILY_GLOBAL_MAX ?? "", 10);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  const now = Date.now();
  if (now - globalDayStart > RATE_DAILY_WINDOW_MS) {
    globalDayStart = now;
    globalDayCount = 0;
  }
  globalDayCount++;
  return globalDayCount > cap;
}

function isValidContentBlock(b: unknown): boolean {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (o.type === "text") {
    return typeof o.text === "string" && o.text.length <= MAX_TEXT_PER_MESSAGE;
  }
  if (o.type === "tool_use") {
    return (
      typeof o.id === "string" &&
      typeof o.name === "string" &&
      o.input !== null &&
      typeof o.input === "object"
    );
  }
  if (o.type === "tool_result") {
    if (typeof o.tool_use_id !== "string") return false;
    if (typeof o.content === "string") return o.content.length <= MAX_TEXT_PER_MESSAGE;
    if (Array.isArray(o.content)) return o.content.every(isValidContentBlock);
    return false;
  }
  return false;
}

function isValidMessage(m: unknown): boolean {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  if (o.role !== "user" && o.role !== "assistant") return false;
  if (typeof o.content === "string") return o.content.length <= MAX_TEXT_PER_MESSAGE;
  if (Array.isArray(o.content)) return o.content.every(isValidContentBlock);
  return false;
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
  const limited = rateLimited(ip);
  if (limited === "burst") {
    return json({ ok: false, error: "Has hecho muchas preguntas seguidas. Espera un momento y vuelve a intentarlo." }, 429);
  }
  if (limited === "daily") {
    return json({ ok: false, error: "Has alcanzado el límite diario del asistente. Vuelve mañana o usa el buscador." }, 429);
  }
  if (globalKillSwitchTripped()) {
    return json({ ok: false, error: "El asistente está temporalmente fuera de servicio. Usa el buscador, por favor." }, 503);
  }

  // Cap del body crudo ANTES de parsear: corta el ataque de "messages" enorme.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ ok: false, error: "Petición inválida." }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Petición demasiado grande." }, 413);
  }

  let messages: ChatMessage[];
  try {
    const body = JSON.parse(raw);
    if (!body || !Array.isArray(body.messages)) throw new Error("bad body");
    if (!body.messages.every(isValidMessage)) throw new Error("bad message shape");
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

      if (process.env.NODE_ENV !== "production") {
        const u = response.usage;
        // Si `cacheRead` sigue a 0 en peticiones repetidas seguidas, el prefijo (tools+system)
        // no llega al mínimo cacheable de Haiku 4.5 (~4096 tok): hay que alargar el system prompt.
        console.log("[chat]", {
          in: u.input_tokens,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          out: u.output_tokens,
        });
      }

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
