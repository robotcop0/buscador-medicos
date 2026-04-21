/**
 * Endpoint on-demand para reseñas de Google Maps.
 *
 * GET /api/google-reviews?placeId=<id>&page=<n>
 *   → { reviews: GoogleReview[], page, total, hasMore, source }
 *
 * Cada página son 10 reseñas. El cursor opaco que devuelve el sidecar entre
 * páginas lo cacheamos por placeId para poder pedir la siguiente. Reseñas
 * cacheadas en memoria con TTL de 24h, y persistidas a disco en
 * `data/google-reviews.json` al mismo estilo que Doctoralia.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { GoogleReview } from "@/lib/types";

const SIDECAR_URL = process.env.GMAPS_SIDECAR_URL || "http://127.0.0.1:8765";
const TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const SIDECAR_TIMEOUT_MS = 20_000;
const REVIEWS_FILE = path.join(process.cwd(), "data", "google-reviews.json");

type Entry = { reviews: GoogleReview[]; at: number; total?: number; nextCursor?: string };
const pageCache: Map<string, Entry> = new Map();
let seeded = false;

function cacheKey(placeId: string, page: number): string {
  return `${placeId}::p${page}`;
}

function seedFromDisk(): void {
  if (seeded) return;
  seeded = true;
  try {
    if (!fs.existsSync(REVIEWS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")) as Record<
      string,
      GoogleReview[]
    >;
    const at = Date.now();
    for (const [placeId, reviews] of Object.entries(raw)) {
      if (Array.isArray(reviews) && reviews.length > 0) {
        pageCache.set(cacheKey(placeId, 1), { reviews, at });
      }
    }
  } catch {
    // seed opcional; si falla, cada placeId cae a fetch live
  }
}

function persistPage1(placeId: string, reviews: GoogleReview[]): void {
  try {
    let all: Record<string, GoogleReview[]> = {};
    if (fs.existsSync(REVIEWS_FILE)) {
      all = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")) as Record<string, GoogleReview[]>;
    }
    all[placeId] = reviews;
    fs.mkdirSync(path.dirname(REVIEWS_FILE), { recursive: true });
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch {
    // si falla la persistencia, seguimos sirviendo desde cache en memoria
  }
}

export async function GET(req: Request): Promise<Response> {
  seedFromDisk();

  const params = new URL(req.url).searchParams;
  const placeId = (params.get("placeId") || "").trim();
  const pageParam = parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
  const refresh = params.get("refresh") === "1";

  if (!placeId || !placeId.startsWith("0x")) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss", error: "invalid placeId" },
      { status: 400 }
    );
  }

  const key = cacheKey(placeId, page);
  const cached = pageCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) {
    const total = cached.total ?? cached.reviews.length;
    return NextResponse.json(
      {
        reviews: cached.reviews,
        page,
        total,
        hasMore: !!cached.nextCursor || page * PAGE_SIZE < total,
        source: "cache",
      },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  }

  // Para paginar necesitamos el cursor de la página anterior
  let cursor = "";
  if (page > 1) {
    const prev = pageCache.get(cacheKey(placeId, page - 1));
    if (!prev || !prev.nextCursor) {
      return NextResponse.json(
        { reviews: [], page, total: 0, hasMore: false, source: "miss", error: "no cursor" },
        { status: 200 }
      );
    }
    cursor = prev.nextCursor;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
  let sidecarResp: Response | null = null;
  try {
    const qs = `place_id=${encodeURIComponent(placeId)}&cursor=${encodeURIComponent(cursor)}&limit=${PAGE_SIZE}`;
    sidecarResp = await fetch(`${SIDECAR_URL}/reviews?${qs}`, { signal: controller.signal });
  } catch {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss" },
      { status: 200 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!sidecarResp.ok) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss" },
      { status: 200 }
    );
  }

  const data = (await sidecarResp.json()) as {
    reviews: Array<{
      author: string;
      rating: number;
      date: string;
      text: string;
      reply_text?: string;
      reply_date?: string;
    }>;
    next_cursor?: string;
    total?: number;
  } | null;

  if (!data) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss" },
      { status: 200 }
    );
  }

  const reviews: GoogleReview[] = (data.reviews || []).map((r) => ({
    author: r.author,
    rating: r.rating,
    date: r.date,
    comment: r.text,
    reply: r.reply_text
      ? { text: r.reply_text, date: r.reply_date || "" }
      : undefined,
  }));

  const total = data.total ?? reviews.length;
  const nextCursor = data.next_cursor || undefined;

  pageCache.set(key, { reviews, at: Date.now(), total, nextCursor });
  if (page === 1 && reviews.length > 0) persistPage1(placeId, reviews);

  return NextResponse.json(
    {
      reviews,
      page,
      total,
      hasMore: !!nextCursor,
      source: "live",
    },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
