/**
 * Scraper incremental de reseñas de Doctoralia.
 *
 * Entrada:  `data/doctoralia-ratings.json` — requiere haber corrido antes
 *           `scrape-doctoralia-ratings`.
 * Salida 1: mismo `data/doctoralia-ratings.json` con un campo extra
 *           `reviews?: Array<{author,rating,date,comment}>` por cada profile
 *           visitado (solo los que tienen `rating > 0`).
 * Salida 2: `data/doctoralia-reviews.json` — índice compacto `{url: reviews[]}`
 *           cargado en runtime por `lib/ratings-index.ts` (evita rehidratar el
 *           JSON gigante de ratings en el servidor Next).
 *
 * Resiliencia:
 * - Throttle 250ms + backoff exponencial ante 403/429.
 * - Retoma desde donde se dejó: si el profile ya tiene `reviews`, lo salta.
 * - Checkpoint cada 100 perfiles (flush parcial a disco).
 */
import * as fs from "fs";
import * as path from "path";
import { fetchWithBackoff, parseReviews, type Review } from "../lib/doctoralia";

type DoctoraliaProfile = {
  entityId: string;
  url: string;
  name: string;
  especialidadDoctoralia: string;
  especialidadCanonical: string;
  provincia: string;
  cities: string[];
  streets: string[];
  rating: number;
  numReviews: number;
  reviews?: Review[];
};

const RATINGS_JSON = path.join(__dirname, "../data/doctoralia-ratings.json");
const REVIEWS_INDEX_JSON = path.join(__dirname, "../data/doctoralia-reviews.json");
const DOCTORS_JSON = path.join(__dirname, "../data/doctors.json");
const DELAY_MS = 250;
const CHECKPOINT_EVERY = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function writeReviewsIndex(profiles: DoctoraliaProfile[]): void {
  const index: Record<string, Review[]> = {};
  for (const p of profiles) {
    if (p.reviews && p.reviews.length > 0) index[p.url] = p.reviews;
  }
  fs.writeFileSync(REVIEWS_INDEX_JSON, JSON.stringify(index));
}

async function main() {
  if (!fs.existsSync(RATINGS_JSON)) {
    console.error(`No existe ${RATINGS_JSON}`);
    process.exit(1);
  }
  const profiles = JSON.parse(
    fs.readFileSync(RATINGS_JSON, "utf-8")
  ) as DoctoraliaProfile[];

  // Filtramos a perfiles realmente referenciados por doctors.json (matched):
  // así solo hidratamos los que la UI va a pedir en runtime (≈ 10× menos).
  let matchedUrls: Set<string> | null = null;
  if (fs.existsSync(DOCTORS_JSON)) {
    const doctors = JSON.parse(fs.readFileSync(DOCTORS_JSON, "utf-8")) as Array<{
      doctoraliaUrl?: string;
    }>;
    matchedUrls = new Set(
      doctors.map((d) => d.doctoraliaUrl).filter((u): u is string => !!u)
    );
    console.log(`URLs referenciadas en doctors.json: ${matchedUrls.size}`);
  }

  const targets = profiles.filter((p) => {
    if (!(p.rating > 0) || p.reviews) return false;
    if (matchedUrls && !matchedUrls.has(p.url)) return false;
    return true;
  });
  const alreadyDone = profiles.filter((p) => p.reviews && p.reviews.length > 0).length;
  console.log(
    `Total profiles: ${profiles.length}. Ya con reviews: ${alreadyDone}. Pendientes: ${targets.length}`
  );

  let ok = 0;
  let empty = 0;
  let fail = 0;
  const start = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i];
    const html = await fetchWithBackoff(p.url);
    if (html === null) {
      fail++;
      p.reviews = [];
    } else {
      const revs = parseReviews(html);
      p.reviews = revs;
      if (revs.length > 0) ok++;
      else empty++;
    }

    if ((i + 1) % 25 === 0) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (targets.length - i - 1) / rate;
      console.log(
        `  ${i + 1}/${targets.length}  ok=${ok} empty=${empty} fail=${fail}  ${rate.toFixed(1)}/s  ETA ${Math.round(eta)}s`
      );
    }

    if ((i + 1) % CHECKPOINT_EVERY === 0) {
      fs.writeFileSync(RATINGS_JSON, JSON.stringify(profiles));
      writeReviewsIndex(profiles);
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(RATINGS_JSON, JSON.stringify(profiles));
  writeReviewsIndex(profiles);

  const withReviews = profiles.filter((p) => p.reviews && p.reviews.length > 0).length;
  console.log(
    `\n✓ Done. Perfiles con reseñas: ${withReviews}. ok=${ok} empty=${empty} fail=${fail}`
  );
  console.log(`  Índice escrito → ${path.relative(process.cwd(), REVIEWS_INDEX_JSON)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
