/**
 * Endpoint on-demand para rating+numReviews de Google Maps.
 *
 * GET /api/google-rating?nombre=<string>&cp=<5digits>&ciudad=<string>
 *   → { rating, numReviews, placeId, source: "cache"|"live"|"miss" }
 *
 * Solo se acepta `nombre` que matchee CENTER_RE (centros médicos). Para
 * personas devolvemos 400 — Google da resultados basura para nombres propios
 * de médicos y además queremos evitar sobrecargar el sidecar.
 *
 * Cache: 7 días en `data/google-ratings.json` (via persistGoogleRating).
 * Cuando hay hit válido en cache se responde instantáneo; si no, llamada
 * al sidecar Python (localhost:8765). Si el sidecar no está arriba,
 * devolvemos source:"miss" con 200 para que la UI no rompa.
 */
import { NextResponse } from "next/server";
import { normNameKey } from "@/lib/ratings-index";
import {
  CENTER_RE,
  lookupGoogle,
  persistGoogleRating,
} from "@/lib/google-ratings-index";
import { resultLooksRelevant } from "@/lib/google-match";

const SIDECAR_URL = process.env.GMAPS_SIDECAR_URL || "http://127.0.0.1:8765";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const SIDECAR_TIMEOUT_MS = 15_000;

type Ok = {
  rating: number;
  numReviews: number;
  placeId: string;
  source: "cache" | "live" | "miss";
};

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const nombre = (params.get("nombre") || "").trim();
  const cp = (params.get("cp") || "").trim();
  const ciudad = (params.get("ciudad") || "").trim();

  if (!nombre || !cp || cp.length < 2) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss", error: "missing nombre or cp" },
      { status: 400 }
    );
  }

  if (!CENTER_RE.test(nombre)) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss", error: "not a center" },
      { status: 400 }
    );
  }

  const cpPrefix = cp.slice(0, 2);
  const nameKey = normNameKey(nombre);

  // Cache hit (≤7 días)
  const cached = lookupGoogle(nombre, cp);
  if (cached && Date.now() - cached.at < TTL_MS && cached.rating > 0) {
    const body: Ok = {
      rating: cached.rating,
      numReviews: cached.numReviews,
      placeId: cached.placeId,
      source: "cache",
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  }

  // Llamada al sidecar
  const q = [nombre, ciudad].filter(Boolean).join(" ");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
  let sidecarResp: Response | null = null;
  try {
    sidecarResp = await fetch(`${SIDECAR_URL}/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    });
  } catch {
    // sidecar caído o timeout
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss" },
      { status: 200 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!sidecarResp.ok) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss" },
      { status: 200 }
    );
  }

  const data = (await sidecarResp.json()) as {
    place_id: string;
    name: string;
    rating: number;
    review_count: number;
    address: string;
  } | null;

  if (!data || !data.place_id || !data.rating || !data.review_count) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss" },
      { status: 200 }
    );
  }

  if (!resultLooksRelevant(nombre, data.name)) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss", note: "irrelevant" },
      { status: 200 }
    );
  }

  persistGoogleRating({
    nameKey,
    cpPrefix,
    nombreOriginal: nombre,
    rating: data.rating,
    numReviews: data.review_count,
    placeId: data.place_id,
    address: data.address,
    at: Date.now(),
  });

  const body: Ok = {
    rating: data.rating,
    numReviews: data.review_count,
    placeId: data.place_id,
    source: "live",
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}
