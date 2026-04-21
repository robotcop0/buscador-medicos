/**
 * Enriquecimiento live de centros con Google Maps server-side.
 *
 * Llamado desde `app/resultados/page.tsx` tras paginar: dados los 20
 * doctores visibles, para los que son centros y no tienen `googleRating`
 * ya cacheado, dispara en paralelo al sidecar Python y persiste los hits.
 *
 * Se ejecuta BLOQUEANDO el SSR (decisión de diseño — ver refinement 1
 * del plan). Primera carga de una query nueva: +2-4s. Segundas visitas
 * sirven todo desde cache (<500 ms).
 */
import type { Doctor, GoogleReview } from "@/lib/types";
import { isCenter } from "@/lib/center";
import { normNameKey } from "@/lib/ratings-index";
import {
  lookupGoogle,
  persistGoogleRating,
  type GoogleRatingRecord,
} from "@/lib/google-ratings-index";
import { mergeRatings } from "@/lib/ratings-merge";
import { resultLooksRelevant } from "@/lib/google-match";

const SIDECAR_URL = process.env.GMAPS_SIDECAR_URL || "http://127.0.0.1:8765";

type Opts = {
  concurrency?: number;
  perRequestTimeoutMs?: number;
  globalTimeoutMs?: number;
};

type SidecarSearchResp = {
  place_id: string;
  name: string;
  rating: number;
  review_count: number;
  address: string;
} | null;

type LiveHit = {
  rating: number;
  numReviews: number;
  placeId: string;
  address: string;
};

async function callSidecarSearch(
  nombre: string,
  ciudad: string,
  timeoutMs: number
): Promise<LiveHit | null> {
  const q = [nombre, ciudad].filter(Boolean).join(" ");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${SIDECAR_URL}/search?q=${encodeURIComponent(q)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as SidecarSearchResp;
    if (!data || !data.place_id || !data.rating || !data.review_count) return null;
    if (!resultLooksRelevant(nombre, data.name)) return null;
    return {
      rating: data.rating,
      numReviews: data.review_count,
      placeId: data.place_id,
      address: data.address || "",
    };
  } catch {
    // sidecar caído, timeout o red
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ejecuta `task()` para cada item con `limit` concurrencia. Resuelve
 * cuando todos terminan O cuando expira `abortSignal.aborted` (en cuyo
 * caso devuelve los resultados parciales acumulados hasta ese momento).
 */
async function parallelLimited<T, R>(
  items: T[],
  limit: number,
  task: (item: T, i: number) => Promise<R | null>,
  abortSignal: AbortSignal
): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;

  async function worker() {
    while (next < items.length && !abortSignal.aborted) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function enrichCentrosLive(
  doctors: Doctor[],
  opts?: Opts
): Promise<Doctor[]> {
  const concurrency = opts?.concurrency ?? 5;
  const perRequestTimeoutMs = opts?.perRequestTimeoutMs ?? 8_000;
  const globalTimeoutMs = opts?.globalTimeoutMs ?? 10_000;

  // Qué centros necesitan live
  const toFetchIdx: number[] = [];
  for (let i = 0; i < doctors.length; i++) {
    const d = doctors[i];
    if (!isCenter(d.nombre)) continue;
    if (d.googleRating && d.googleRating > 0) continue; // ya cacheado en memoria/disk
    if (lookupGoogle(d.nombre, d.cp)) continue; // cache hit directo
    toFetchIdx.push(i);
  }

  if (toFetchIdx.length === 0) return doctors;

  const globalController = new AbortController();
  const globalTimer = setTimeout(() => globalController.abort(), globalTimeoutMs);

  const items = toFetchIdx.map((i) => doctors[i]);
  const hits = await parallelLimited(
    items,
    concurrency,
    (d) => callSidecarSearch(d.nombre, d.ciudad, perRequestTimeoutMs),
    globalController.signal
  );
  clearTimeout(globalTimer);

  // Persistimos y construimos el array enriquecido
  const out = [...doctors];
  for (let k = 0; k < hits.length; k++) {
    const hit = hits[k];
    if (!hit) continue;
    const i = toFetchIdx[k];
    const d = doctors[i];
    const rec: GoogleRatingRecord = {
      nameKey: normNameKey(d.nombre),
      cpPrefix: d.cp.slice(0, 2),
      nombreOriginal: d.nombre,
      rating: hit.rating,
      numReviews: hit.numReviews,
      placeId: hit.placeId,
      address: hit.address,
      at: Date.now(),
    };
    try {
      persistGoogleRating(rec);
    } catch {
      // persistencia best-effort; seguimos aunque falle el write
    }
    const enriched: Doctor = {
      ...d,
      googleRating: hit.rating,
      googleNumReviews: hit.numReviews,
      googlePlaceId: hit.placeId,
    };
    out[i] = mergeRatings(enriched);
  }

  // También aplicamos mergeRatings a los centros que ya tenían datos Google
  // pero quizás no habían pasado por merge (p.ej. si la ruta no los procesó).
  // Seguro y barato: si ya estaban mergeados, mergeRatings es idempotente.
  for (let i = 0; i < out.length; i++) {
    const d = out[i];
    if (!isCenter(d.nombre)) continue;
    if (d.googleRating && d.googleRating > 0) {
      out[i] = mergeRatings(d);
    }
  }

  return out;
}

export type { GoogleReview };
