/**
 * Índice en memoria para propagar `rating`, `numReviews` y `doctoraliaUrl`
 * desde el offline Adeslas (enriquecido por `scraper/enrich-ratings.ts`)
 * hacia los resultados de las fuentes *live* (Allianz, Occident, Mapfre, …)
 * que devuelven `rating: 0` porque sus APIs no exponen reseñas.
 *
 * La clave usa tokens del nombre **ordenados** para tolerar los distintos
 * formatos del offline (p.ej. `"Dr. Aparici Sanz, Alvaro"` vs
 * `"Alvaro Aparici Sanz"` que una fuente live pueda devolver), combinados
 * con la especialidad normalizada y el prefijo de CP (provincia).
 */
import { doctors } from "@/data/doctors";
import type { Doctor, DoctoraliaReview } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

function normNameKey(s: string): string {
  const normalized = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(dr\.?a?\.?\s+|sra?\.?\s+)/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized
    .split(" ")
    .filter((t) => t.length > 2)
    .sort()
    .join(" ");
}

function normEspKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

type RatingEntry = { rating: number; numReviews: number; doctoraliaUrl?: string };

let indexCache: Map<string, RatingEntry> | null = null;
let reviewsByUrlCache: Map<string, DoctoraliaReview[]> | null = null;
let reviewsMtime = 0;

const REVIEWS_FILE = path.join(process.cwd(), "data", "doctoralia-reviews.json");

function getReviewsByUrl(): Map<string, DoctoraliaReview[]> {
  // Invalidamos por mtime: el scraper reescribe el archivo cada checkpoint
  // mientras rellena reseñas, así recogemos incrementos sin reiniciar Next.
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(REVIEWS_FILE).mtimeMs;
  } catch {
    currentMtime = 0;
  }
  if (reviewsByUrlCache && currentMtime === reviewsMtime) return reviewsByUrlCache;

  const m = new Map<string, DoctoraliaReview[]>();
  if (currentMtime > 0) {
    try {
      const raw = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")) as Record<
        string,
        DoctoraliaReview[]
      >;
      for (const [url, revs] of Object.entries(raw)) {
        if (revs && revs.length > 0) m.set(url, revs);
      }
    } catch {
      // Archivo opcional/corrupto; continuamos sin reseñas.
    }
  }
  reviewsByUrlCache = m;
  reviewsMtime = currentMtime;
  return m;
}

function getIndex(): Map<string, RatingEntry> {
  if (indexCache) return indexCache;
  const m = new Map<string, RatingEntry>();
  for (const d of doctors) {
    if (!d.doctoraliaUrl && d.rating === 0) continue;
    const nameKey = normNameKey(d.nombre);
    if (!nameKey) continue;
    const key = `${nameKey}::${normEspKey(d.especialidad)}::${d.cp.slice(0, 2)}`;
    const existing = m.get(key);
    // Si colisionan varias filas (misma persona en varios CPs de la misma
    // provincia), quédate con la que tenga rating > 0.
    if (!existing || (existing.rating === 0 && d.rating > 0)) {
      m.set(key, {
        rating: d.rating,
        numReviews: d.numReviews,
        doctoraliaUrl: d.doctoraliaUrl,
      });
    }
  }
  indexCache = m;
  return m;
}

export function enrichWithDoctoralia(doctor: Doctor): Doctor {
  let enriched: Doctor = doctor;
  if (!(doctor.rating > 0 && doctor.doctoraliaUrl) && doctor.cp && doctor.cp.length >= 2) {
    const idx = getIndex();
    const key = `${normNameKey(doctor.nombre)}::${normEspKey(doctor.especialidad)}::${doctor.cp.slice(0, 2)}`;
    const hit = idx.get(key);
    if (hit) {
      enriched = {
        ...doctor,
        rating: doctor.rating || hit.rating,
        numReviews: doctor.numReviews || hit.numReviews,
        ...(hit.doctoraliaUrl ? { doctoraliaUrl: hit.doctoraliaUrl } : {}),
      };
    }
  }

  if (enriched.doctoraliaUrl && !enriched.doctoraliaReviews) {
    const reviews = getReviewsByUrl().get(enriched.doctoraliaUrl);
    if (reviews && reviews.length > 0) {
      enriched = { ...enriched, doctoraliaReviews: reviews };
    }
  }
  return enriched;
}
