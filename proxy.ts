/**
 * Proxy anti-scraping (antes `middleware.ts` — Next 16 renombró la convención).
 *
 * - `/api/*`: exige Origin/Referer del propio dominio + rate limit por ruta +
 *   bloqueo de UAs de scraper obvios + `X-Robots-Tag: noindex`.
 *   Para `/api/chat` además exige `POST` + `Content-Type: application/json`.
 * - `/resultados`: rate limit más generoso para tráfico humano normal.
 *
 * Implementación in-memory por instancia (best-effort). En producción tras
 * Vercel/Cloudflare combinar con su WAF; aquí el objetivo es cortar curl
 * sencillo y bots ingenuos, no un atacante con red de IPs rotativa.
 */
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
// Buckets por ruta — el chat es caro (tokens de Claude), google-rating se
// dispara ~20 en paralelo al cargar /resultados, los demás son one-shot.
const LIMITS_PER_API_ROUTE: Array<{ prefix: string; max: number }> = [
  { prefix: "/api/chat", max: 12 },
  { prefix: "/api/google-rating", max: 90 },
  { prefix: "/api/google-reviews", max: 30 },
  { prefix: "/api/doctoralia-reviews", max: 30 },
];
const API_DEFAULT_LIMIT = 30;
const PAGE_LIMIT = 60; // /resultados — humanos navegando
const MAX_BUCKETS = 10_000;

const CRAWLER_UA_RE =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Applebot|Slurp|Baiduspider/i;

// UAs de scraper obvios — cortamos lo perezoso. Un atacante motivado pone una
// UA de navegador, pero le obligamos a hacerlo (no es gratis).
const SCRAPER_UA_RE =
  /\b(curl|wget|libwww-perl|python-requests|python-urllib|aiohttp|httpx|httpie|Go-http-client|Java-http-client|java\/\d|okhttp|scrapy|node-fetch|axios\/|got\s|undici|insomnia|postmanruntime|HeadlessChrome|PhantomJS|HTTPie)\b/i;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function sameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

function pruneIfNeeded(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS / 2) break;
  }
}

function rateLimitOk(key: string, max: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    pruneIfNeeded(now);
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

function apiLimitFor(pathname: string): { bucket: string; max: number } {
  for (const r of LIMITS_PER_API_ROUTE) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) {
      return { bucket: r.prefix, max: r.max };
    }
  }
  return { bucket: "api:default", max: API_DEFAULT_LIMIT };
}

function denied(status: number, body: string, extra?: Record<string, string>): NextResponse {
  const headers: Record<string, string> = { "X-Robots-Tag": "noindex, nofollow" };
  if (extra) Object.assign(headers, extra);
  return new NextResponse(body, { status, headers });
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") ?? "";

  if (pathname.startsWith("/api/")) {
    // 1. Same-origin (Origin/Referer) — corta curl-sin-flags.
    if (!sameOrigin(req)) {
      return denied(403, "Forbidden");
    }

    // 2. UA blocklist — corta scrapers que no se molestan en falsificar UA.
    if (!ua || SCRAPER_UA_RE.test(ua)) {
      return denied(403, "Forbidden");
    }

    // 3. /api/chat: exige POST + JSON. GET/HEAD/etc. directo fuera.
    if (pathname === "/api/chat") {
      if (req.method !== "POST") {
        return denied(405, "Method Not Allowed", { Allow: "POST" });
      }
      const ct = req.headers.get("content-type") ?? "";
      if (!ct.toLowerCase().startsWith("application/json")) {
        return denied(415, "Unsupported Media Type");
      }
    }

    // 4. Rate limit por ruta (no bucket combinado: el chat no debe consumir
    //    quota de google-rating).
    const { bucket, max } = apiLimitFor(pathname);
    if (!rateLimitOk(`${bucket}:${ip}`, max)) {
      return denied(429, "Too Many Requests", { "Retry-After": "60" });
    }

    // OK: pasa y añade noindex en la respuesta.
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (pathname === "/resultados") {
    const isCrawler = CRAWLER_UA_RE.test(ua);
    if (!isCrawler && !rateLimitOk(`page:${ip}`, PAGE_LIMIT)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/resultados"],
};
