/**
 * Índice en memoria para propagar `rating`, `numReviews` y `doctoraliaUrl`
 * desde Doctoralia hacia los resultados de cualquier fuente (offline Adeslas
 * o live: Allianz, Occident, Mapfre, Sanitas, AXA, Caser, Cigna, Divina, Asisa,
 * DKV, IMQ, Fiatc, Generali, MUFACE).
 *
 * Se alimenta DIRECTAMENTE de `data/doctoralia-ratings.json` (≈28 k perfiles
 * con rating) en lugar de `data/doctors.json`, para que también enriquezcan
 * doctores que no figuran en el cuadro médico de Adeslas.
 *
 * Clave: tokens del nombre **ordenados** (tolerante a "Apellido, Nombre" vs
 * "Nombre Apellido", con/ sin "Dr.") + prefijo de CP (provincia). La
 * especialidad se usa a posteriori para desempatar candidatos homónimos en la
 * misma provincia usando match **parcial accent-insensitive** (la canónica de
 * Doctoralia es corta — "Cardiología" — y la del live puede ser larga —
 * "Cardiología Infantil").
 */
import type { Doctor, DoctoraliaReview } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

export function normNameKey(s: string): string {
  const normalized = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Provincia (texto Doctoralia) → prefijo de CP (2 dígitos). Los comentarios
// en lib/coordinates.ts documentan esta tabla; la replicamos para ir del nombre
// al prefijo sin parsear ese archivo.
const PROVINCIA_TO_CP: Record<string, string> = {
  "a coruna": "15",
  "alava": "01",
  "albacete": "02",
  "alicante": "03",
  "almeria": "04",
  "asturias": "33",
  "avila": "05",
  "badajoz": "06",
  "baleares": "07",
  "barcelona": "08",
  "burgos": "09",
  "caceres": "10",
  "cadiz": "11",
  "cantabria": "39",
  "castellon": "12",
  "ceuta": "51",
  "ciudad real": "13",
  "cordoba": "14",
  "cuenca": "16",
  "girona": "17",
  "granada": "18",
  "guadalajara": "19",
  "guipuzcoa": "20",
  "huelva": "21",
  "huesca": "22",
  "jaen": "23",
  "la rioja": "26",
  "las palmas": "35",
  "leon": "24",
  "lleida": "25",
  "lugo": "27",
  "madrid": "28",
  "malaga": "29",
  "melilla": "52",
  "murcia": "30",
  "navarra": "31",
  "ourense": "32",
  "palencia": "34",
  "pontevedra": "36",
  "salamanca": "37",
  "santa cruz de tenerife": "38",
  "tenerife": "38",
  "segovia": "40",
  "sevilla": "41",
  "soria": "42",
  "tarragona": "43",
  "teruel": "44",
  "toledo": "45",
  "valencia": "46",
  "valladolid": "47",
  "vizcaya": "48",
  "zamora": "49",
  "zaragoza": "50",
};

function cpPrefixFromProvincia(provincia: string): string | null {
  const key = normText(provincia);
  return PROVINCIA_TO_CP[key] ?? null;
}

type Candidate = {
  rating: number;
  numReviews: number;
  url: string;
  canonical: string;
};

type RatingsProfile = {
  url: string;
  name: string;
  especialidadDoctoralia?: string;
  especialidadCanonical?: string;
  provincia?: string;
  rating: number;
  numReviews: number;
};

let indexCache: Map<string, Candidate[]> | null = null;
let reviewsByUrlCache: Map<string, DoctoraliaReview[]> | null = null;
let reviewsMtime = 0;

const RATINGS_FILE = path.join(process.cwd(), "data", "doctoralia-ratings.json");
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

function getIndex(): Map<string, Candidate[]> {
  if (indexCache) return indexCache;
  const m = new Map<string, Candidate[]>();
  let raw: RatingsProfile[] = [];
  try {
    raw = JSON.parse(fs.readFileSync(RATINGS_FILE, "utf-8")) as RatingsProfile[];
  } catch {
    indexCache = m;
    return m;
  }
  for (const p of raw) {
    if (!(p.rating > 0) || !p.url) continue;
    const cpPrefix = p.provincia ? cpPrefixFromProvincia(p.provincia) : null;
    if (!cpPrefix) continue;
    const nameKey = normNameKey(p.name);
    if (!nameKey) continue;
    const key = `${nameKey}::${cpPrefix}`;
    const entry: Candidate = {
      rating: p.rating,
      numReviews: p.numReviews || 0,
      url: p.url,
      canonical: p.especialidadCanonical || p.especialidadDoctoralia || "",
    };
    const list = m.get(key);
    if (list) list.push(entry);
    else m.set(key, [entry]);
  }
  indexCache = m;
  return m;
}

function pickCandidate(candidates: Candidate[], especialidad: string): Candidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const esp = normText(especialidad);
  if (!esp) return candidates[0];
  // Match parcial en las dos direcciones: Doctoralia canónica suele ser
  // genérica ("Cardiología") y la del live puede venir con sufijo
  // ("Cardiología Infantil", "Cardiología Clínica"); nos vale cualquiera.
  const byEsp = candidates.find((c) => {
    const can = normText(c.canonical);
    if (!can) return false;
    return esp.includes(can) || can.includes(esp);
  });
  return byEsp ?? candidates[0];
}

export function enrichWithDoctoralia(doctor: Doctor): Doctor {
  let enriched: Doctor = doctor;
  if (!(doctor.rating > 0 && doctor.doctoraliaUrl) && doctor.cp && doctor.cp.length >= 2) {
    const idx = getIndex();
    const key = `${normNameKey(doctor.nombre)}::${doctor.cp.slice(0, 2)}`;
    const candidates = idx.get(key);
    if (candidates && candidates.length > 0) {
      const hit = pickCandidate(candidates, doctor.especialidad);
      if (hit && hit.rating > 0) {
        enriched = {
          ...doctor,
          rating: doctor.rating || hit.rating,
          numReviews: doctor.numReviews || hit.numReviews,
          doctoraliaUrl: doctor.doctoraliaUrl || hit.url,
        };
      }
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
