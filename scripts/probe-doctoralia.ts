/**
 * probe-doctoralia.ts
 *
 * Task 9 — Investigación: mide la tasa real de médicos (personas, sin nota)
 * que SÍ están en Doctoralia pero NO están en nuestro índice scrapeado.
 *
 * Para cada doctor de la muestra hace una búsqueda LIVE por nombre en
 * doctoralia.es (misma URL base y headers que `scraper/sources/doctoralia.ts`),
 * parsea los resultados con cheerio y clasifica:
 *
 *   ON_DOCTORALIA_RATED   → perfil encontrado y tiene rating > 0
 *   ON_DOCTORALIA_NORATING → perfil encontrado, rating = 0
 *   NOT_FOUND             → ninguna coincidencia suficiente
 *   BLOCKED               → 403 / 429 / challenge / error de red
 *
 * Muestra MIXTA: ~12 urbanos (28=Madrid, 08=Barcelona, 41=Sevilla, 46=Valencia)
 * + ~12 rurales (44=Teruel, 42=Soria, 16=Cuenca, 05=Ávila, 49=Zamora,
 * 34=Palencia, 40=Segovia, 19=Guadalajara).
 *
 * Ejecutar:
 *   npx tsx scripts/probe-doctoralia.ts
 */

import { createRequire } from "module";
import axios from "axios";
import * as cheerio from "cheerio";
import type { Doctor } from "@/lib/types";
import { isCenter } from "@/lib/center";
import { enrichWithDoctoralia, normNameKey } from "@/lib/ratings-index";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const URBAN_PREFIXES = ["28", "08", "41", "46"];
const RURAL_PREFIXES = ["44", "42", "16", "05", "49", "34", "40", "19"];
const SAMPLE_SIZE_EACH = 12; // 12 urban + 12 rural = 24 total
const DELAY_MS = 1800; // ≥1.5s entre requests — throttle anti-bot
const REQUEST_TIMEOUT_MS = 18_000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Classification =
  | "ON_DOCTORALIA_RATED"
  | "ON_DOCTORALIA_NORATING"
  | "NOT_FOUND"
  | "BLOCKED";

interface ProbeResult {
  kind: "urban" | "rural";
  nombre: string;
  especialidad: string;
  ciudad: string;
  cp: string;
  classification: Classification;
  matchedName?: string;
  matchedRating?: number;
  matchedReviews?: number;
  matchedUrl?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Deterministic seeded sample — consistent across runs */
function seededSample<T>(arr: T[], n: number, seed = 42): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/**
 * Normalise name for token-based fuzzy matching.
 * Strips "Dr./Dra.", accents, non-alpha chars, lowercases.
 * Returns sorted token array.
 */
function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(dr\.?a?\.?\s+|sra?\.?\s+)/i, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Returns a score [0,1] of how well `candidate` matches `query`.
 * We count what fraction of query tokens appear in candidate tokens.
 * A score ≥ 0.6 means "plausible match".
 */
function nameMatchScore(query: string, candidate: string): number {
  const queryTokens = normalizeTokens(query);
  const candidateTokens = new Set(normalizeTokens(candidate));
  if (queryTokens.length === 0) return 0;
  const hits = queryTokens.filter((t) => candidateTokens.has(t)).length;
  return hits / queryTokens.length;
}

const MATCH_THRESHOLD = 0.6; // ≥60% of query tokens must appear in result

// ---------------------------------------------------------------------------
// Live Doctoralia search
// ---------------------------------------------------------------------------

interface DoctorResult {
  nombre: string;
  rating: number;
  numReviews: number;
  url: string;
  especialidad: string;
}

async function searchDoctoralia(
  nombre: string,
  ciudad: string
): Promise<{ results: DoctorResult[]; blocked: boolean }> {
  // Build URL: search by doctor name (q param) + city
  const url = new URL("https://www.doctoralia.es/buscar");
  url.searchParams.set("q", nombre);
  if (ciudad) url.searchParams.set("city", ciudad);

  try {
    const res = await axios.get(url.toString(), {
      headers: HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: (status) => status < 500,
    });

    const status = res.status;

    // Anti-bot responses
    if (status === 403 || status === 429) {
      return { results: [], blocked: true };
    }

    // Check for bot challenge pages (e.g. Cloudflare, hCaptcha)
    const html = res.data as string;
    if (
      status !== 200 ||
      html.includes("challenge-platform") ||
      html.includes("hcaptcha") ||
      html.includes("cf-browser-verification") ||
      html.includes("Just a moment") ||
      html.includes("Please wait") ||
      html.includes("Verifying you are human")
    ) {
      return { results: [], blocked: true };
    }

    // Parse results with cheerio (same pattern as scraper/sources/doctoralia.ts)
    const $ = cheerio.load(html);
    const results: DoctorResult[] = [];

    $("[data-id='result-item']").each((_, el) => {
      const card = $(el);

      // data-doctor-name attr (very reliable)
      const doctorName = card.attr("data-doctor-name")?.trim() ?? "";
      if (!doctorName || doctorName.length < 3) return;

      // Ratings — note: Doctoralia uses single-quoted attrs, cheerio handles both
      const ratingStr = card.attr("data-eec-stars-rating") ?? "0";
      const reviewsStr = card.attr("data-eec-opinions-count") ?? "0";
      const rating = parseFloat(ratingStr) || 0;
      const numReviews = parseInt(reviewsStr, 10) || 0;

      const especialidad =
        card.attr("data-eec-specialization-name") ?? "";
      const profileUrl = card.attr("data-doctor-url") ?? "";

      results.push({
        nombre: doctorName,
        rating,
        numReviews,
        especialidad,
        url: profileUrl,
      });
    });

    return { results, blocked: false };
  } catch (err: unknown) {
    const e = err as { response?: { status: number }; code?: string };
    const status = e?.response?.status;
    // Network errors or timeout → count as blocked (can't distinguish from server block)
    if (!status || status === 403 || status === 429 || e?.code === "ECONNABORTED") {
      return { results: [], blocked: true };
    }
    // Other HTTP errors → not found (server responded but no useful content)
    return { results: [], blocked: false };
  }
}

// ---------------------------------------------------------------------------
// Classify a single doctor
// ---------------------------------------------------------------------------

async function probeDoctor(
  doc: Doctor,
  kind: "urban" | "rural"
): Promise<ProbeResult> {
  const { results, blocked } = await searchDoctoralia(doc.nombre, doc.ciudad);

  if (blocked) {
    return {
      kind,
      nombre: doc.nombre,
      especialidad: doc.especialidad,
      ciudad: doc.ciudad,
      cp: doc.cp,
      classification: "BLOCKED",
      note: "anti-bot / timeout / network error",
    };
  }

  // Find best matching result using token-overlap score
  let bestScore = 0;
  let bestMatch: DoctorResult | null = null;

  for (const r of results) {
    const score = nameMatchScore(doc.nombre, r.nombre);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = r;
    }
  }

  if (!bestMatch || bestScore < MATCH_THRESHOLD) {
    return {
      kind,
      nombre: doc.nombre,
      especialidad: doc.especialidad,
      ciudad: doc.ciudad,
      cp: doc.cp,
      classification: "NOT_FOUND",
      note: `best_score=${bestScore.toFixed(2)}, results=${results.length}`,
    };
  }

  const classification: Classification =
    bestMatch.rating > 0 ? "ON_DOCTORALIA_RATED" : "ON_DOCTORALIA_NORATING";

  return {
    kind,
    nombre: doc.nombre,
    especialidad: doc.especialidad,
    ciudad: doc.ciudad,
    cp: doc.cp,
    classification,
    matchedName: bestMatch.nombre,
    matchedRating: bestMatch.rating,
    matchedReviews: bestMatch.numReviews,
    matchedUrl: bestMatch.url,
    note: `score=${bestScore.toFixed(2)}`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== probe-doctoralia.ts — T9: medir cobertura real en Doctoralia live ===\n");

  // Load all doctors
  const doctorsRaw: Doctor[] = require("../data/doctors.json");

  // Filter to persons (not centers)
  const persons = doctorsRaw.filter((d) => !isCenter(d.nombre));

  // Enrich via offline index and keep those still unrated
  console.log("Enriqueciendo con índice offline...");
  const unratedPersons = persons
    .map((d) => enrichWithDoctoralia(d))
    .filter((d) => !(d.rating > 0));

  console.log(`Total personas: ${persons.length}`);
  console.log(`Sin nota tras enrichWithDoctoralia: ${unratedPersons.length}\n`);

  // Split by region
  const unratedUrban = unratedPersons.filter(
    (d) => d.cp && URBAN_PREFIXES.some((p) => d.cp.startsWith(p))
  );
  const unratedRural = unratedPersons.filter(
    (d) => d.cp && RURAL_PREFIXES.some((p) => d.cp.startsWith(p))
  );

  console.log(`Pool urbano (sin nota): ${unratedUrban.length}`);
  console.log(`Pool rural (sin nota): ${unratedRural.length}\n`);

  // Seeded sample
  const urbanSample = seededSample(unratedUrban, SAMPLE_SIZE_EACH, 42);
  const ruralSample = seededSample(unratedRural, SAMPLE_SIZE_EACH, 99);

  console.log(`Muestra: ${urbanSample.length} urbanos + ${ruralSample.length} rurales = ${urbanSample.length + ruralSample.length} total`);
  console.log(`Throttle: ${DELAY_MS}ms entre requests (~${Math.round(((urbanSample.length + ruralSample.length) * DELAY_MS) / 1000)}s estimado)\n`);
  console.log("─".repeat(80));

  const results: ProbeResult[] = [];

  const allSamples: Array<[Doctor, "urban" | "rural"]> = [
    ...urbanSample.map((d): [Doctor, "urban" | "rural"] => [d, "urban"]),
    ...ruralSample.map((d): [Doctor, "urban" | "rural"] => [d, "rural"]),
  ];

  for (let i = 0; i < allSamples.length; i++) {
    const [doc, kind] = allSamples[i];
    const prefix = kind === "urban" ? "🏙  urbano" : "🌿 rural  ";

    process.stdout.write(
      `[${String(i + 1).padStart(2, "0")}/${allSamples.length}] ${prefix} | ${doc.nombre.padEnd(35)} | ${doc.ciudad.padEnd(20)} | consultando... `
    );

    try {
      const result = await probeDoctor(doc, kind);
      results.push(result);

      const cls = result.classification.padEnd(26);
      let extra = "";
      if (result.matchedName) {
        extra = `→ "${result.matchedName}" ${result.matchedRating}★ (${result.matchedReviews} reseñas)`;
      } else if (result.note) {
        extra = result.note;
      }
      console.log(`${cls} ${extra}`);
    } catch (err) {
      results.push({
        kind,
        nombre: doc.nombre,
        especialidad: doc.especialidad,
        ciudad: doc.ciudad,
        cp: doc.cp,
        classification: "BLOCKED",
        note: `unexpected error: ${String(err)}`,
      });
      console.log("BLOCKED (unexpected error)");
    }

    // Throttle — skip after last request
    if (i < allSamples.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log("\n" + "═".repeat(80));
  console.log("RESUMEN");
  console.log("═".repeat(80));

  const categories: Classification[] = [
    "ON_DOCTORALIA_RATED",
    "ON_DOCTORALIA_NORATING",
    "NOT_FOUND",
    "BLOCKED",
  ];

  const countBy = (
    arr: ProbeResult[],
    cls: Classification
  ) => arr.filter((r) => r.classification === cls).length;

  const urban = results.filter((r) => r.kind === "urban");
  const rural = results.filter((r) => r.kind === "rural");

  const pct = (n: number, total: number) =>
    total === 0 ? "n/a" : `${((n / total) * 100).toFixed(0)}%`;

  console.log(`\n${"Clasificación".padEnd(30)} ${"URBANO".padEnd(15)} ${"RURAL".padEnd(15)} TOTAL`);
  console.log("─".repeat(70));
  for (const cls of categories) {
    const u = countBy(urban, cls);
    const r = countBy(rural, cls);
    const t = u + r;
    const uStr = `${u} (${pct(u, urban.length)})`.padEnd(15);
    const rStr = `${r} (${pct(r, rural.length)})`.padEnd(15);
    console.log(`${cls.padEnd(30)} ${uStr} ${rStr} ${t} (${pct(t, results.length)})`);
  }

  console.log("─".repeat(70));
  console.log(
    `${"TOTAL".padEnd(30)} ${String(urban.length).padEnd(15)} ${String(rural.length).padEnd(15)} ${results.length}`
  );

  // Interpretation
  const onDoctoralia = results.filter(
    (r) => r.classification === "ON_DOCTORALIA_RATED" || r.classification === "ON_DOCTORALIA_NORATING"
  );
  const onDoctorialiaRated = results.filter((r) => r.classification === "ON_DOCTORALIA_RATED");
  const notFound = results.filter((r) => r.classification === "NOT_FOUND");
  const blocked = results.filter((r) => r.classification === "BLOCKED");

  const validResults = results.filter((r) => r.classification !== "BLOCKED");

  console.log("\n" + "═".repeat(80));
  console.log("INTERPRETACIÓN");
  console.log("═".repeat(80));
  console.log(`Total sondados    : ${results.length}`);
  console.log(`Bloqueados (BLOCKED): ${blocked.length} — excluidos del análisis`);
  console.log(`Válidos           : ${validResults.length}`);
  console.log(
    `En Doctoralia     : ${onDoctoralia.length} (${pct(onDoctoralia.length, validResults.length)} de válidos) — de ellos ${onDoctorialiaRated.length} con rating > 0`
  );
  console.log(
    `No encontrados    : ${notFound.length} (${pct(notFound.length, validResults.length)} de válidos)`
  );

  if (blocked.length > validResults.length * 0.5) {
    console.log(
      "\n⚠️  AVISO: >50% de requests bloqueados. Doctoralia activó anti-bot. Los porcentajes son estimados."
    );
  }

  const onDocRate = validResults.length > 0
    ? onDoctoralia.length / validResults.length
    : 0;

  console.log("\n" + "─".repeat(80));
  if (onDocRate >= 0.3) {
    console.log(
      `CONCLUSIÓN: El ${pct(onDoctoralia.length, validResults.length)} de médicos sin nota SÍ están en Doctoralia (no scrapeados).`
    );
    console.log("→ Ampliar el scrape de Doctoralia ES rentable.");
  } else {
    console.log(
      `CONCLUSIÓN: Solo el ${pct(onDoctoralia.length, validResults.length)} de médicos sin nota están en Doctoralia.`
    );
    console.log("→ Ampliar el scrape de Doctoralia tiene BAJO rendimiento.");
    console.log("→ La palanca principal debe ser otro origen (p.ej. batch Google + fallback-centro).");
  }
  console.log("═".repeat(80));
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
