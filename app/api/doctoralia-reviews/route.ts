/**
 * Endpoint on-demand para reseñas de Doctoralia.
 *
 * GET /api/doctoralia-reviews?url=<perfil>&page=<n>
 *   → { reviews: Review[], page, total, hasMore, source }
 *
 * page=1 (o sin param) hace fetch del perfil SSR (hasta 10 reseñas).
 * page>=2 hace fetch al XHR público `/ajax/mobile/doctor-opinions/{id}/{page}`
 * que Doctoralia usa cuando pulsas "Ver más opiniones anteriores".
 *
 * Cacheamos en memoria por `url::page` con TTL de 24 h. El id del doctor
 * (necesario para paginar) se extrae del HTML de page=1 y se cachea aparte.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  fetchOpinionsPage,
  fetchWithBackoff,
  parseDoctorId,
  parseReviewTotal,
  parseReviews,
  type Review,
} from "@/lib/doctoralia";

const ALLOWED_PREFIX = "https://www.doctoralia.es/";
const TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const SEED_FILE = path.join(process.cwd(), "data", "doctoralia-reviews.json");

type Entry = { reviews: Review[]; at: number; total?: number };
const pageCache: Map<string, Entry> = new Map();
const doctorIdCache: Map<string, string> = new Map();
let seeded = false;

function cacheKey(url: string, page: number): string {
  return `${url}::p${page}`;
}

function seedFromDisk(): void {
  if (seeded) return;
  seeded = true;
  try {
    if (!fs.existsSync(SEED_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8")) as Record<
      string,
      Review[]
    >;
    const at = Date.now();
    for (const [url, reviews] of Object.entries(raw)) {
      if (Array.isArray(reviews) && reviews.length > 0) {
        pageCache.set(cacheKey(url, 1), { reviews, at });
      }
    }
  } catch {
    // Si el seed falla, cache vacío; cada URL caerá a fetch live.
  }
}

export async function GET(req: Request): Promise<Response> {
  seedFromDisk();

  const params = new URL(req.url).searchParams;
  const url = params.get("url");
  const pageParam = parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
  const refresh = params.get("refresh") === "1";

  if (!url || !url.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss", error: "invalid url" },
      { status: 400 }
    );
  }

  const key = cacheKey(url, page);
  const cached = pageCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) {
    const total = cached.total ?? cached.reviews.length;
    return NextResponse.json(
      {
        reviews: cached.reviews,
        page,
        total,
        hasMore: page * PAGE_SIZE < total,
        source: "cache",
      },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  }

  if (page === 1) {
    const html = await fetchWithBackoff(url);
    if (!html) {
      return NextResponse.json(
        { reviews: [], page, total: 0, hasMore: false, source: "miss" },
        { status: 200 }
      );
    }
    const reviews = parseReviews(html);
    const total = parseReviewTotal(html) ?? reviews.length;
    const doctorId = parseDoctorId(html);
    if (doctorId) doctorIdCache.set(url, doctorId);
    pageCache.set(key, { reviews, at: Date.now(), total });
    return NextResponse.json(
      {
        reviews,
        page,
        total,
        hasMore: reviews.length === PAGE_SIZE && total > reviews.length,
        source: "live",
      },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  }

  // page >= 2: necesitamos el doctor id. Si no lo tenemos en cache, hacemos
  // una pasada por page=1 primero para capturarlo.
  let doctorId = doctorIdCache.get(url);
  if (!doctorId) {
    const html = await fetchWithBackoff(url);
    if (html) {
      doctorId = parseDoctorId(html) ?? undefined;
      if (doctorId) doctorIdCache.set(url, doctorId);
      // Aprovechamos y sembramos page=1 si aún no estaba.
      if (!pageCache.has(cacheKey(url, 1))) {
        const reviews = parseReviews(html);
        const total = parseReviewTotal(html) ?? reviews.length;
        pageCache.set(cacheKey(url, 1), { reviews, at: Date.now(), total });
      }
    }
  }

  if (!doctorId) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss" },
      { status: 200 }
    );
  }

  const res = await fetchOpinionsPage(doctorId, page);
  if (!res) {
    return NextResponse.json(
      { reviews: [], page, total: 0, hasMore: false, source: "miss" },
      { status: 200 }
    );
  }

  pageCache.set(key, { reviews: res.reviews, at: Date.now(), total: res.total });
  return NextResponse.json(
    {
      reviews: res.reviews,
      page,
      total: res.total,
      hasMore: page * PAGE_SIZE < res.total,
      source: "live",
    },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
