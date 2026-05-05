/**
 * Middleware anti-scraping.
 *
 * - `/api/*`: exige Origin/Referer del propio dominio + rate limit estricto.
 * - `/resultados`: rate limit más generoso para tráfico humano normal.
 *
 * Implementación in-memory por instancia (best-effort). En producción tras
 * Vercel/Cloudflare combinar con su WAF; aquí el objetivo es cortar curl
 * sencillo y bots ingenuos, no un atacante con red de IPs rotativa.
 */
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const API_LIMIT = 30; // /api/* — endpoints que son disparados click-a-click
const PAGE_LIMIT = 60; // /resultados — humanos navegando
const MAX_BUCKETS = 10_000;

const CRAWLER_UA_RE =
  /Googlebot|Bingbot|DuckDuckBot|YandexBot|Applebot|Slurp|Baiduspider/i;

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

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const ip = getIp(req);

  if (pathname.startsWith("/api/")) {
    if (!sameOrigin(req)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!rateLimitOk(`api:${ip}`, API_LIMIT)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  } else if (pathname === "/resultados") {
    const ua = req.headers.get("user-agent") ?? "";
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
