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
import {
  CENTER_RE,
  lookupGoogle,
  persistGoogleRating,
} from "@/lib/google-ratings-index";
import { resolveGoogleRating } from "@/lib/google-resolve";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

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
  const especialidad = (params.get("especialidad") || "").trim();

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

  // Resolución vía sidecar (lógica compartida con el batch offline)
  const record = await resolveGoogleRating({ nombre, cp, ciudad, especialidad });

  if (!record) {
    return NextResponse.json(
      { rating: 0, numReviews: 0, placeId: "", source: "miss" },
      { status: 200 }
    );
  }

  persistGoogleRating(record);

  const body: Ok = {
    rating: record.rating,
    numReviews: record.numReviews,
    placeId: record.placeId,
    source: "live",
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}
