/**
 * Helpers compartidos entre el scraper batch (`scraper/scrape-doctoralia-reviews.ts`)
 * y la API route on-demand (`app/api/doctoralia-reviews/route.ts`). Centraliza la
 * lógica de fetch + parseo para que los dos caminos produzcan el mismo formato.
 */
import axios from "axios";
import * as cheerio from "cheerio";

export type Review = {
  author: string;
  rating: number;
  date: string;
  comment: string;
};

const TIMEOUT_MS = 15000;
// Doctoralia renderiza hasta ~10 reseñas por página en el perfil. Parseamos
// todas y dejamos que la UI decida cuántas enseñar inicialmente y cuántas
// añadir al pulsar "Ver más".
const MAX_REVIEWS = 10;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithBackoff(url: string): Promise<string | null> {
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT_MS });
      return res.data as string;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      const status = e?.response?.status;
      if (status === 404) return null;
      if ((status === 403 || status === 405 || status === 429) && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      return null;
    }
  }
  return null;
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseReviews(html: string): Review[] {
  const $ = cheerio.load(html);
  const nodes = $('[itemprop="review"]').toArray();
  const reviews: Review[] = [];
  for (const node of nodes) {
    const el = $(node);
    const authorEl = el.find('[itemprop="author"]').first();
    const author =
      cleanText(authorEl.find('[itemprop="name"]').first().text()) ||
      cleanText(authorEl.text()) ||
      "Anónimo";
    const ratingEl = el.find('[itemprop="ratingValue"]').first();
    const ratingRaw = ratingEl.attr("content") || ratingEl.text();
    const rating = parseFloat(ratingRaw) || 0;
    const dateEl = el.find('[itemprop="datePublished"]').first();
    const date = cleanText(dateEl.attr("content") || dateEl.text());
    const comment = cleanText(
      el.find('[itemprop="reviewBody"], [itemprop="description"]').first().text()
    );
    if (!comment) continue;
    reviews.push({
      author: author.slice(0, 60),
      rating,
      date: date.slice(0, 40),
      comment: comment.slice(0, 600),
    });
    if (reviews.length >= MAX_REVIEWS) break;
  }
  return reviews;
}
