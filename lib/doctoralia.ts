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
// Doctoralia renderiza 10 reseñas por página (tanto en el perfil SSR como en
// el endpoint XHR `/ajax/mobile/doctor-opinions/{id}/{page}`).
const PAGE_SIZE = 10;

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
    if (reviews.length >= PAGE_SIZE) break;
  }
  return reviews;
}

/**
 * Extrae el `entity id` del doctor del HTML de la página de perfil. Doctoralia
 * lo expone tanto en `data-eec-entity-id` como en `data-profile-id`. Lo usa el
 * endpoint AJAX para paginar las reseñas (`/ajax/mobile/doctor-opinions/{id}/{page}`).
 */
export function parseDoctorId(html: string): string | null {
  const m =
    html.match(/data-eec-entity-id=["'](\d+)["']/) ||
    html.match(/data-profile-id=["'](\d+)["']/);
  return m ? m[1] : null;
}

/**
 * Total de opiniones declaradas en el perfil (puede superar al nº parseable:
 * no todas llevan comentario). Se extrae del meta `numberOfReviews` schema.org
 * o, como fallback, del texto "N opiniones".
 */
export function parseReviewTotal(html: string): number | null {
  const $ = cheerio.load(html);
  const metaCount =
    $('[itemprop="reviewCount"]').attr("content") ||
    $('[itemprop="ratingCount"]').attr("content");
  if (metaCount) {
    const n = parseInt(metaCount, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const textMatch = html.match(/(\d{1,5})\s+opiniones/i);
  if (textMatch) {
    const n = parseInt(textMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Descarga la página `page` (1-indexed) de reseñas via el endpoint AJAX que
 * usa el propio botón "Ver más opiniones anteriores" del perfil. Devuelve las
 * reseñas parseadas y el total declarado por Doctoralia para decidir si hay
 * más páginas por pedir.
 */
export async function fetchOpinionsPage(
  doctorId: string,
  page: number
): Promise<{ reviews: Review[]; total: number } | null> {
  const url = `https://www.doctoralia.es/ajax/mobile/doctor-opinions/${encodeURIComponent(
    doctorId
  )}/${page}`;
  try {
    const res = await axios.get(url, {
      headers: { ...HEADERS, Accept: "application/json, text/plain, */*" },
      timeout: TIMEOUT_MS,
    });
    const data = res.data as { limit?: number; numRows?: number; html?: string };
    if (!data || typeof data.html !== "string") return null;
    const reviews = parseReviews(data.html);
    const total = Number.isFinite(data.numRows) ? Number(data.numRows) : reviews.length;
    return { reviews, total };
  } catch {
    return null;
  }
}
