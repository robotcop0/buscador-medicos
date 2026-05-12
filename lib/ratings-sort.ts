import type { Doctor } from "@/lib/types";

/**
 * Límites del peso del prior "m" (ver `bayesianScore`). m se calcula de forma
 * adaptativa como la **mediana de reseñas** de los valorados del listado, pero
 * se acota a este rango para que ni un pool de centros con 1 reseña haga que
 * confiemos en todo (m muy bajo) ni un pool de hospitales enormes aplaste todas
 * las diferencias (m enorme).
 */
const RANK_M_MIN = 8;
const RANK_M_MAX = 150;

/** Fallback de la media global cuando el listado no tiene suficientes valorados. */
const RANK_PRIOR_FALLBACK = 4.5;

/**
 * Promedio bayesiano (fórmula tipo IMDb Top 250):
 *
 *   score = v/(v+m)·R + m/(v+m)·C
 *
 * R = nota del centro, v = nº de reseñas, m = peso del prior (≈ reseñas típicas
 * del listado), C = media de las notas del listado. Con pocas reseñas la nota
 * se "arrastra" hacia C; con muchas, manda la nota real. Así un 5,0 con 1 reseña
 * no adelanta a un 4,9 con miles. m es adaptativo: si el listado típico tiene
 * ~15 reseñas, basta con superar eso para empezar a destacar; si tiene cientos,
 * hace falta más volumen.
 */
function bayesianScore(rating: number, numReviews: number, prior: number, m: number): number {
  return (numReviews / (numReviews + m)) * rating + (m / (numReviews + m)) * prior;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Orden estándar del listado:
 * - Valorados (rating > 0 && numReviews > 0) primero, por **score bayesiano↓**
 *   y, en empate, por **distancia↑** (más cerca mejor). Si no hay CP, desempata
 *   por nº reseñas↓ (más reseñas = señal más robusta).
 * - No valorados después, por distancia↑ (o por nombre si no hay CP).
 */
export function sortByRating(doctors: Doctor[]): Doctor[] {
  const rated: Doctor[] = [];
  const unrated: Doctor[] = [];
  for (const d of doctors) {
    if (d.numReviews > 0 && d.rating > 0) rated.push(d);
    else unrated.push(d);
  }

  // C = media de las notas del propio listado (prior). Si hay muy pocos
  // valorados la media es poco representativa → usamos el fallback.
  const prior =
    rated.length >= 3
      ? rated.reduce((s, d) => s + d.rating, 0) / rated.length
      : RANK_PRIOR_FALLBACK;

  // m = mediana de reseñas del listado (robusta frente a outliers tipo hospital
  // con miles de reseñas), acotada a [RANK_M_MIN, RANK_M_MAX].
  const m =
    rated.length >= 3
      ? clamp(median(rated.map((d) => d.numReviews)), RANK_M_MIN, RANK_M_MAX)
      : RANK_M_MIN;

  const ratedScored = rated.map((d) => ({
    ...d,
    rankScore: bayesianScore(d.rating, d.numReviews, prior, m),
  }));

  ratedScored.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.numReviews - a.numReviews;
  });
  unrated.sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.nombre.localeCompare(b.nombre, "es");
  });
  return [...ratedScored, ...unrated];
}
