/**
 * Endpoint on-demand para reseñas de Doctoralia.
 *
 * GET /api/doctoralia-reviews?url=<perfil>
 *   → { reviews: Review[], source: "cache" | "live" | "miss" }
 *
 * El primer request por URL es ~500–1500 ms (fetch Doctoralia + parseo cheerio).
 * Los sucesivos son instantáneos: cacheamos en memoria por proceso Next con TTL
 * de 24 h.
 *
 * La cache se siembra perezosamente con el snapshot `data/doctoralia-reviews.json`
 * que ya tenemos de la pasada batch (2 217 perfiles en este momento), así los
 * cards cuyo doctor esté ahí contestan al instante incluso tras reiniciar Next.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { fetchWithBackoff, parseReviews, type Review } from "@/lib/doctoralia";

const ALLOWED_PREFIX = "https://www.doctoralia.es/";
const TTL_MS = 24 * 60 * 60 * 1000;
const SEED_FILE = path.join(process.cwd(), "data", "doctoralia-reviews.json");

type Entry = { reviews: Review[]; at: number };
const cache: Map<string, Entry> = new Map();
let seeded = false;

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
        cache.set(url, { reviews, at });
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
  // `refresh=1` fuerza un fetch live saltando la cache. Lo usa la UI cuando el
  // usuario pide "Ver más" y lo que tenemos en cache era el cap antiguo de 3.
  const refresh = params.get("refresh") === "1";
  if (!url || !url.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { reviews: [], source: "miss", error: "invalid url" },
      { status: 400 }
    );
  }

  const cached = cache.get(url);
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(
      { reviews: cached.reviews, source: "cache" },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  }

  const html = await fetchWithBackoff(url);
  if (!html) {
    return NextResponse.json({ reviews: [], source: "miss" }, { status: 200 });
  }

  const reviews = parseReviews(html);
  cache.set(url, { reviews, at: Date.now() });

  return NextResponse.json(
    { reviews, source: "live" },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
