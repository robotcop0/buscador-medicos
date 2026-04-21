/**
 * Índice en memoria con los ratings de Google Maps para centros médicos
 * (clínicas, hospitales, policlínicos, ambulatorios, centros médicos…).
 *
 * No operamos sobre personas: el test con el scraper de jinef-john demostró
 * que para nombres propios Google devuelve resultados muy inconsistentes
 * (hospitales random, la ciudad pelada, etc.). Para centros el match es
 * casi perfecto y hay cientos/miles de reseñas útiles.
 *
 * Clave: `normNameKey(nombre)::cp.slice(0,2)` — misma convención que
 * `ratings-index.ts` para Doctoralia.
 *
 * El archivo se escribe desde `/api/google-rating` a medida que el sidecar
 * devuelve resultados. Lo leemos aquí para enriquecer resultados de búsqueda
 * server-side sin tener que pasar por la API route.
 */
import type { Doctor } from "@/lib/types";
import { normNameKey } from "@/lib/ratings-index";
import { CENTER_RE, isCenter } from "@/lib/center";
import * as fs from "fs";
import * as path from "path";

// Re-exportamos para que los llamadores server-side (API routes, search)
// puedan traer todo desde un solo módulo.
export { CENTER_RE, isCenter };

export type GoogleRatingRecord = {
  nameKey: string;
  cpPrefix: string;
  nombreOriginal: string;
  rating: number;
  numReviews: number;
  placeId: string;
  address?: string;
  at: number;
};

const RATINGS_FILE = path.join(process.cwd(), "data", "google-ratings.json");

let indexCache: Map<string, GoogleRatingRecord> | null = null;
let indexMtime = 0;

function readRatingsFile(): GoogleRatingRecord[] {
  try {
    const raw = fs.readFileSync(RATINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as GoogleRatingRecord[];
  } catch {
    // archivo ausente o corrupto — índice vacío
  }
  return [];
}

function getIndex(): Map<string, GoogleRatingRecord> {
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(RATINGS_FILE).mtimeMs;
  } catch {
    currentMtime = 0;
  }
  if (indexCache && currentMtime === indexMtime) return indexCache;

  const m = new Map<string, GoogleRatingRecord>();
  for (const rec of readRatingsFile()) {
    if (!rec.nameKey || !rec.cpPrefix) continue;
    const key = `${rec.nameKey}::${rec.cpPrefix}`;
    const prev = m.get(key);
    // Si hay varias entradas con la misma clave, nos quedamos con la más
    // reciente (mismo sitio, pero otro CP exacto, o reescraping).
    if (!prev || rec.at > prev.at) m.set(key, rec);
  }
  indexCache = m;
  indexMtime = currentMtime;
  return m;
}

export function lookupGoogle(nombre: string, cp: string): GoogleRatingRecord | null {
  if (!isCenter(nombre)) return null;
  if (!cp || cp.length < 2) return null;
  const key = `${normNameKey(nombre)}::${cp.slice(0, 2)}`;
  return getIndex().get(key) ?? null;
}

export function enrichWithGoogle(doctor: Doctor): Doctor {
  // No-op para personas; solo centros.
  if (!isCenter(doctor.nombre)) return doctor;
  // Si ya lo tenía (p.ej. inyectado en runtime), no lo pisamos.
  if (doctor.googleRating && doctor.googleRating > 0) return doctor;

  const hit = lookupGoogle(doctor.nombre, doctor.cp);
  if (!hit || !(hit.rating > 0)) return doctor;

  return {
    ...doctor,
    googleRating: hit.rating,
    googleNumReviews: hit.numReviews,
    googlePlaceId: hit.placeId,
  };
}

/**
 * Añade/actualiza un registro en `data/google-ratings.json`. Usado por la
 * API route cuando el sidecar devuelve un resultado vivo. Invalida la cache
 * en memoria (lo hará también el mtime bump, pero lo hacemos explícito).
 */
export function persistGoogleRating(rec: GoogleRatingRecord): void {
  const existing = readRatingsFile();
  const key = `${rec.nameKey}::${rec.cpPrefix}`;
  const idx = existing.findIndex((r) => `${r.nameKey}::${r.cpPrefix}` === key);
  if (idx >= 0) existing[idx] = rec;
  else existing.push(rec);
  fs.mkdirSync(path.dirname(RATINGS_FILE), { recursive: true });
  fs.writeFileSync(RATINGS_FILE, JSON.stringify(existing, null, 2), "utf-8");
  indexCache = null; // forzamos relectura a la próxima
  indexMtime = 0;
}
