/**
 * verify-coverage.ts
 *
 * Spot-check ~30 médicos sin valoración de municipios pequeños para clasificar
 * el gap de cobertura:
 *   inDoctoralia  → perfil encontrado en el índice local de Doctoralia (no scrapeado aún)
 *   inGoogle      → hallado vía sidecar Google Maps pero no en Doctoralia
 *   nowhere       → sin rastro en ninguna fuente
 *
 * El scraper de Doctoralia (`scraper/sources/doctoralia.ts`) exporta solo
 * `scrapeDoctoralia()` (bulk-batch que raspa Doctoralia.es por ciudad/especialidad/mutua)
 * y NO tiene una función de búsqueda por nombre individual — su diseño es de
 * ingestión masiva, no de lookup ad-hoc. Por ello la verificación de Doctoralia
 * se hace offline sobre `data/doctoralia-ratings.json` (índice en memoria via
 * `enrichWithDoctoralia` de `lib/ratings-index.ts`): si el médico no aparece
 * ahí, se lo considera "en Doctoralia pero sin scrapear" SOLO cuando el sidecar
 * Google lo devuelve con un perfil de médico individual (categorías como
 * "Cardiólogo", "Médico"). Si Google también falla → nowhere.
 *
 * Ejecutar:
 *   node --env-file-if-exists=.env.local --import tsx scripts/verify-coverage.ts
 */

import { createRequire } from "module";
import type { Doctor } from "@/lib/types";
import { isCenter } from "@/lib/center";
import { enrichWithDoctoralia, normNameKey } from "@/lib/ratings-index";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SMALL_PREFIXES = ["44", "42", "16", "05", "49", "34"];
const SAMPLE_SIZE = 30;
const GOOGLE_SIDECAR = "http://localhost:8765";
const SIDECAR_TIMEOUT_MS = 10_000;
const DELAY_BETWEEN_REQUESTS_MS = 400;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Deterministic pseudo-random shuffle so we get a representative spread. */
function seededSample<T>(arr: T[], n: number, seed = 42): T[] {
  const a = [...arr];
  // Simple LCG-based shuffle
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------------------------------------------------------------------------
// Doctoralia offline check
// Replicates the lookup logic of getIndex() to expose whether the name is
// present AT ALL (with or without rating) in the raw ratings file.
// ---------------------------------------------------------------------------

type RatingsProfile = {
  url: string;
  name: string;
  especialidadDoctoralia?: string;
  especialidadCanonical?: string;
  provincia?: string;
  rating: number;
  numReviews: number;
};

const PROVINCIA_TO_CP: Record<string, string> = {
  "a coruna": "15", alava: "01", albacete: "02", alicante: "03", almeria: "04",
  asturias: "33", avila: "05", badajoz: "06", baleares: "07", barcelona: "08",
  burgos: "09", caceres: "10", cadiz: "11", cantabria: "39", castellon: "12",
  ceuta: "51", "ciudad real": "13", cordoba: "14", cuenca: "16", girona: "17",
  granada: "18", guadalajara: "19", guipuzcoa: "20", huelva: "21", huesca: "22",
  jaen: "23", "la rioja": "26", "las palmas": "35", leon: "24", lleida: "25",
  lugo: "27", madrid: "28", malaga: "29", melilla: "52", murcia: "30",
  navarra: "31", ourense: "32", palencia: "34", pontevedra: "36", salamanca: "37",
  "santa cruz de tenerife": "38", tenerife: "38", segovia: "40", sevilla: "41",
  soria: "42", tarragona: "43", teruel: "44", toledo: "45", valencia: "46",
  valladolid: "47", vizcaya: "48", zamora: "49", zaragoza: "50",
};

function buildAllNamesIndex(profiles: RatingsProfile[]): Map<string, RatingsProfile[]> {
  const m = new Map<string, RatingsProfile[]>();
  for (const p of profiles) {
    if (!p.name) continue;
    const cpPrefix = p.provincia ? (PROVINCIA_TO_CP[normText(p.provincia)] ?? null) : null;
    if (!cpPrefix) continue;
    const nameKey = normNameKey(p.name);
    if (!nameKey) continue;
    const key = `${nameKey}::${cpPrefix}`;
    const list = m.get(key);
    if (list) list.push(p);
    else m.set(key, [p]);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Google sidecar check
// ---------------------------------------------------------------------------

type GoogleSidecarResult = {
  place_id?: string;
  name?: string;
  rating?: number;
  review_count?: number;
  categories?: string[];
  address?: string;
  lat?: number;
  lng?: number;
  error?: string;
};

async function queryGoogleSidecar(query: string): Promise<GoogleSidecarResult | null> {
  const url = `${GOOGLE_SIDECAR}/search?q=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as GoogleSidecarResult;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== verify-coverage.ts — spot-check gap de valoraciones ===\n");

  // Load doctors
  const doctorsRaw: Doctor[] = require("../data/doctors.json");
  const persons = doctorsRaw.filter((d) => !isCenter(d.nombre));

  // Filter to small-province CPs
  const smallDoctors = persons.filter(
    (d) => d.cp && SMALL_PREFIXES.some((p) => d.cp.startsWith(p))
  );

  // Enrich via Doctoralia index and keep those still without rating
  const unrated = smallDoctors
    .map((d) => enrichWithDoctoralia(d))
    .filter((d) => !(d.rating > 0));

  console.log(
    `Pool: ${persons.length} personas · ${smallDoctors.length} en provincias pequeñas · ${unrated.length} sin nota tras Doctoralia\n`
  );

  if (unrated.length === 0) {
    console.log("No hay médicos sin nota en el pool. Nada que verificar.");
    return;
  }

  // Sample
  const sample = seededSample(unrated, Math.min(SAMPLE_SIZE, unrated.length));
  console.log(`Muestra: ${sample.length} médicos\n`);

  // Build full Doctoralia name index (all profiles, including unrated) to
  // detect "in Doctoralia but not yet rated / not yet scraped".
  const ratingsProfiles: RatingsProfile[] = require("../data/doctoralia-ratings.json");
  const allNamesIdx = buildAllNamesIndex(ratingsProfiles);

  // Results
  type Classification = "inDoctoralia" | "inGoogle" | "nowhere";
  const results: Array<{
    nombre: string;
    especialidad: string;
    cp: string;
    ciudad: string;
    classification: Classification;
    googleName?: string;
    googleRating?: number;
    doctoraliaUrl?: string;
    note?: string;
  }> = [];

  for (const doc of sample) {
    // 1) Offline Doctoralia presence check (by name key + province prefix)
    const nameKey = normNameKey(doc.nombre);
    const cpPrefix = doc.cp.slice(0, 2);
    const docKey = `${nameKey}::${cpPrefix}`;
    const docProfiles = allNamesIdx.get(docKey);
    const inDoctoralia = docProfiles && docProfiles.length > 0;

    if (inDoctoralia) {
      // Present in the index but had no rating → "on Doctoralia but unscraped rating"
      const p = docProfiles![0];
      results.push({
        nombre: doc.nombre,
        especialidad: doc.especialidad,
        cp: doc.cp,
        ciudad: doc.ciudad,
        classification: "inDoctoralia",
        doctoraliaUrl: p.url,
        note: `rating=${p.rating} numReviews=${p.numReviews}`,
      });
      console.log(
        `[Doctoralia] ${doc.nombre} (${doc.especialidad}, ${doc.ciudad}) → ${p.url} rating=${p.rating}`
      );
      continue;
    }

    // 2) Google sidecar check
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
    const query = `Dr ${doc.nombre} ${doc.especialidad} ${doc.ciudad}`;
    const gResult = await queryGoogleSidecar(query);

    if (gResult && gResult.rating && gResult.rating > 0) {
      results.push({
        nombre: doc.nombre,
        especialidad: doc.especialidad,
        cp: doc.cp,
        ciudad: doc.ciudad,
        classification: "inGoogle",
        googleName: gResult.name,
        googleRating: gResult.rating,
        note: `Google: "${gResult.name}" rating=${gResult.rating} reviews=${gResult.review_count}`,
      });
      console.log(
        `[Google]     ${doc.nombre} (${doc.especialidad}, ${doc.ciudad}) → "${gResult.name}" ${gResult.rating}★`
      );
    } else {
      results.push({
        nombre: doc.nombre,
        especialidad: doc.especialidad,
        cp: doc.cp,
        ciudad: doc.ciudad,
        classification: "nowhere",
        note: gResult
          ? `Google devolvió: ${JSON.stringify(gResult).slice(0, 120)}`
          : "sidecar no respondió",
      });
      console.log(
        `[Nowhere]    ${doc.nombre} (${doc.especialidad}, ${doc.ciudad}) → sin rastro`
      );
    }
  }

  // Summary
  const counts = { inDoctoralia: 0, inGoogle: 0, nowhere: 0 };
  for (const r of results) counts[r.classification]++;

  console.log("\n" + "═".repeat(60));
  console.log("RESUMEN");
  console.log("═".repeat(60));
  console.log(`Total verificados : ${results.length}`);
  console.log(`inDoctoralia      : ${counts.inDoctoralia}  (en índice local pero sin rating propagado)`);
  console.log(`inGoogle          : ${counts.inGoogle}  (hallados vía sidecar, no en Doctoralia)`);
  console.log(`nowhere           : ${counts.nowhere}  (sin presencia en ninguna fuente)`);
  console.log("═".repeat(60));

  const pct = (n: number) => ((n / results.length) * 100).toFixed(0) + "%";
  console.log(
    `\nInterpretación: ${pct(counts.inDoctoralia)} en Doctoralia (ampliar scrape rentable), ` +
    `${pct(counts.inGoogle)} solo Google, ${pct(counts.nowhere)} cola real`
  );
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
