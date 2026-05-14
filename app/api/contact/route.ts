import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO_EMAIL = "damecorreospapa@gmail.com";
// Por defecto el sandbox público de Resend (no requiere verificar dominio,
// pero impone que el destinatario sea el dueño de la cuenta). Cuando se
// verifique un dominio se puede sobrescribir con CONTACT_FROM_EMAIL.
const FROM_EMAIL_FALLBACK = "Buscador de Médicos <onboarding@resend.dev>";

// ── Caps ─────────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 8 * 1024;
const MAX_NAME = 80;
const MAX_EMAIL = 120;
const MAX_SUBJECT = 140;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 4000;

// ── Rate-limit en memoria (igual patrón que /api/chat) ───────────────────
const RATE_BURST_WINDOW_MS = 15 * 60 * 1000;
const RATE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_BURST_MAX = 5;
const RATE_DAILY_MAX = 20;
const rateLog = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return err("El formulario no está disponible ahora mismo. Escríbenos al correo del aviso legal.", 503);
  }

  const ip = clientIp(req);
  const limited = rateLimited(ip);
  if (limited === "burst") {
    return err("Has enviado varios mensajes seguidos. Espera unos minutos y vuelve a intentarlo.", 429);
  }
  if (limited === "daily") {
    return err("Has alcanzado el límite diario de envíos desde tu red. Vuelve mañana, por favor.", 429);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return err("Petición inválida.", 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return err("El mensaje es demasiado largo.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return err("Petición inválida.", 400);
  }
  if (!body || typeof body !== "object") return err("Petición inválida.", 400);

  const { nombre, email, asunto, mensaje, website } = body as Record<string, unknown>;

  // Honeypot: si el bot rellenó el campo oculto, fingimos éxito y descartamos.
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (typeof nombre !== "string" || nombre.trim().length < 2 || nombre.length > MAX_NAME) {
    return err("Indica tu nombre (mínimo 2 caracteres).", 400);
  }
  if (typeof email !== "string" || email.length > MAX_EMAIL || !EMAIL_RE.test(email.trim())) {
    return err("Email no válido.", 400);
  }
  if (asunto !== undefined && (typeof asunto !== "string" || asunto.length > MAX_SUBJECT)) {
    return err("Asunto no válido.", 400);
  }
  if (typeof mensaje !== "string" || mensaje.trim().length < MIN_MESSAGE || mensaje.length > MAX_MESSAGE) {
    return err(`El mensaje debe tener entre ${MIN_MESSAGE} y ${MAX_MESSAGE} caracteres.`, 400);
  }

  const nombreClean = nombre.trim();
  const emailClean = email.trim();
  const asuntoClean = (typeof asunto === "string" ? asunto.trim() : "") || "Consulta sin asunto";
  const mensajeClean = mensaje.trim();

  const subject = `[Buscador de Médicos] ${asuntoClean}`.slice(0, 180);

  const text =
    `Nuevo mensaje desde el formulario de contacto del Buscador de Médicos.\n\n` +
    `Nombre: ${nombreClean}\n` +
    `Email:  ${emailClean}\n` +
    `IP:     ${ip}\n` +
    `Asunto: ${asuntoClean}\n` +
    `\n--- Mensaje ---\n${mensajeClean}\n`;

  const html =
    `<p>Nuevo mensaje desde el formulario de contacto del <strong>Buscador de Médicos</strong>.</p>` +
    `<table style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">` +
    `<tr><td style="color:#666;padding-right:12px">Nombre</td><td>${escapeHtml(nombreClean)}</td></tr>` +
    `<tr><td style="color:#666;padding-right:12px">Email</td><td><a href="mailto:${escapeHtml(emailClean)}">${escapeHtml(emailClean)}</a></td></tr>` +
    `<tr><td style="color:#666;padding-right:12px">IP</td><td>${escapeHtml(ip)}</td></tr>` +
    `<tr><td style="color:#666;padding-right:12px">Asunto</td><td>${escapeHtml(asuntoClean)}</td></tr>` +
    `</table>` +
    `<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />` +
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(mensajeClean)}</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // `||` (no `??`) para tratar también el string vacío como "no configurado".
        from: process.env.CONTACT_FROM_EMAIL || FROM_EMAIL_FALLBACK,
        to: [TO_EMAIL],
        reply_to: emailClean,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[contact] Resend error", res.status, detail);
      return err("No hemos podido enviar el mensaje. Inténtalo de nuevo en unos minutos.", 502);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact] fetch error", e);
    return err("No hemos podido enviar el mensaje. Inténtalo de nuevo en unos minutos.", 502);
  }
}
