/**
 * Lógica compartida de resolución de Google Maps:
 *   1. Construye la query (centros → `nombre ciudad`; personas → `Dr nombre especialidad ciudad`).
 *   2. Llama al sidecar Python en `GMAPS_SIDECAR_URL` (default `http://127.0.0.1:8765`).
 *   3. Valida la relevancia con `resultLooksRelevant`.
 *   4. Devuelve un `GoogleRatingRecord` listo para persistir, o `null` si no hay match.
 *
 * Usada por:
 *   - `app/api/google-rating/route.ts` — on-demand por resultado en cliente.
 *   - `scripts/batch-google-ratings.ts` (Task 5) — batch offline.
 */
import { normNameKey } from "@/lib/ratings-index";
import { isCenter } from "@/lib/center";
import { persistGoogleRating, type GoogleRatingRecord } from "@/lib/google-ratings-index";
import { resultLooksRelevant } from "@/lib/google-match";

export { persistGoogleRating };
export type { GoogleRatingRecord };

const GMAPS_SIDECAR_URL =
  process.env.GMAPS_SIDECAR_URL || "http://127.0.0.1:8765";
const SIDECAR_TIMEOUT_MS = 15_000;

export interface ResolveInput {
  nombre: string;
  cp: string;
  ciudad: string;
  especialidad: string;
}

type SidecarResult = {
  place_id: string;
  name: string;
  rating: number;
  review_count: number;
  address: string;
};

/**
 * Llama al sidecar de Google Maps y devuelve un `GoogleRatingRecord` listo
 * para persistir, o `null` si el sidecar está caído, no devuelve datos, o el
 * resultado no es suficientemente relevante.
 */
export async function resolveGoogleRating(
  input: ResolveInput
): Promise<GoogleRatingRecord | null> {
  const { nombre, cp, ciudad, especialidad } = input;

  const center = isCenter(nombre);
  const q = center
    ? [nombre, ciudad].filter(Boolean).join(" ")
    : ["Dr", nombre, especialidad, ciudad].filter(Boolean).join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
  let sidecarResp: Response;
  try {
    sidecarResp = await fetch(
      `${GMAPS_SIDECAR_URL}/search?q=${encodeURIComponent(q)}`,
      { signal: controller.signal }
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!sidecarResp.ok) return null;

  let data: SidecarResult | null = null;
  try {
    data = (await sidecarResp.json()) as SidecarResult | null;
  } catch {
    return null;
  }

  if (!data || !data.place_id || !data.rating || !data.review_count) {
    return null;
  }

  if (!resultLooksRelevant(nombre, data.name)) {
    return null;
  }

  const record: GoogleRatingRecord = {
    nameKey: normNameKey(nombre),
    cpPrefix: cp.slice(0, 2),
    nombreOriginal: nombre,
    rating: data.rating,
    numReviews: data.review_count,
    placeId: data.place_id,
    address: data.address,
    at: Date.now(),
    kind: "own",
  };

  return record;
}
