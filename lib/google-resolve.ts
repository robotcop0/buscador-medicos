/**
 * Lógica compartida de resolución de Google Maps:
 *   1. Construye la query (centros → `nombre ciudad`; personas → `Dr nombre especialidad ciudad`).
 *   2. Llama al sidecar Python en `GMAPS_SIDECAR_URL` (default `http://127.0.0.1:8765`).
 *   3. Clasifica el resultado como `kind:"own"` (el médico/centro es la entidad buscada)
 *      o `kind:"center"` (Google devolvió la clínica donde trabaja el médico —
 *      fallback-centro guardado con proximidad).
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
import { coordsFromCP, haversineKm, normalizeCp } from "@/lib/coordinates";

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
  /** Coordenadas del lugar en Google Maps (devueltas por el sidecar). */
  lat?: number;
  lng?: number;
};

/**
 * Heurística de zona urbana/rural para limitar el radio de fallback-centro.
 *
 * CP "capital de provincia": los 2 primeros dígitos identifican la provincia;
 * los 3 últimos son el código local. Los CPs de capitales de provincia tienen
 * códigos locales bajos (001–020): p.ej. 28001–28020 (Madrid), 08001–08020
 * (Barcelona), 41001–41020 (Sevilla), etc. Cualquier otro CP se trata como
 * rural/periférico. No pretende ser exacto al 100 %; es un desempate razonable.
 *
 * Umbral:
 *   - Capital (urbano): 8 km  — las clínicas están concentradas, false-positives
 *                               distantes son raros pero más costosos.
 *   - Resto (rural):   25 km  — el médico puede operar en el pueblo más cercano.
 */
function maxKmForCp(cp: string): number {
  // El patrón captura CPs cuyo sufijo local sea 001–020:
  //   ^\d{2}   → prefijo de provincia (2 dígitos)
  //   0(0[1-9]|1[0-9]|20)$ → sufijos 001–009, 010–019, 020
  const CAPITAL_RE = /^\d{2}0(0[1-9]|1[0-9]|20)$/;
  // Normalizamos primero: algunas fuentes live emiten CPs de 4 dígitos (8001
  // en vez de 08001) y el patrón exige los 5 caracteres.
  return CAPITAL_RE.test(normalizeCp(cp)) ? 8 : 25;
}

/**
 * Llama al sidecar de Google Maps y devuelve un `GoogleRatingRecord` listo
 * para persistir, o `null` si el sidecar está caído, no devuelve datos, o el
 * resultado no es suficientemente relevante.
 *
 * Clasificación own/center:
 *   - own:    el nombre del hit coincide con el buscado (resultLooksRelevant) —
 *             vale para centros y para personas con listing propio en Google.
 *   - center: el input es una persona Y Google devolvió una clínica/hospital cercanos.
 *             Se acepta solo si el hit tiene coordenadas y está a ≤ maxKm del CP.
 *   - null:   no encaja en ninguna categoría (descartado) — incluye un centro cuyo
 *             resultado de Google no es relevante (no le colgamos la nota de otro).
 */
export async function resolveGoogleRating(
  input: ResolveInput
): Promise<GoogleRatingRecord | null> {
  const { nombre, cp, ciudad, especialidad } = input;

  const inputIsCenter = isCenter(nombre);
  const q = inputIsCenter
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

  // — Clasificación own/center —
  const nameMatches = resultLooksRelevant(nombre, data.name);

  let kind: "own" | "center";
  let centerName: string | undefined;

  if (nameMatches) {
    // El resultado coincide con lo buscado (centro o médico) → nota propia.
    // Exigimos relevancia también para centros: si Google devuelve un centro
    // distinto, mejor descartar que colgarle una nota ajena.
    kind = "own";
  } else if (!inputIsCenter && isCenter(data.name)) {
    // Google devolvió una clínica/hospital en vez del médico → fallback-centro.
    // Solo aceptamos si el centro está suficientemente cerca del CP del médico.
    const userCoords = coordsFromCP(cp);
    if (!userCoords) return null; // sin coordenadas no podemos verificar proximidad

    // El sidecar puede no devolver lat/lng en todas las respuestas.
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;

    const dist = haversineKm(userCoords, { lat: data.lat, lng: data.lng });
    const maxKm = maxKmForCp(cp);
    if (dist > maxKm) return null; // demasiado lejos → descartamos

    kind = "center";
    centerName = data.name;
  } else {
    // Ni el input ni el hit es un centro, y los nombres no coinciden → descartamos.
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
    kind,
    ...(kind === "center" && centerName ? { centerName } : {}),
  };

  return record;
}
