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
 * Orden estándar del listado — tres tramos estrictos:
 *
 * 0. **Nota propia** (`rating > 0 && ratingKind !== "center"`): por score
 *    bayesiano↓, luego distancia↑, luego nº reseñas↓.
 * 1. **Nota heredada del centro** (`ratingKind === "center"`): misma fórmula
 *    pero SIEMPRE por debajo de cualquier resultado del tramo 0. Un médico con
 *    nota propia baja supera a cualquier médico con nota prestada alta.
 * 2. **Sin valoración** (rating 0): por distancia↑ y nombre.
 *
 * El bayesianScore se calcula sobre **todos** los que tienen rating > 0 (tramos
 * 0 y 1 juntos) para que el prior C y el peso m sean representativos del listado
 * completo. Los tramos se separan solo al ordenar.
 */
export function sortByRating(doctors: Doctor[]): Doctor[] {
  const tierOwn: Doctor[] = [];    // tramo 0: nota propia
  const tierCenter: Doctor[] = []; // tramo 1: nota heredada del centro
  const tierNone: Doctor[] = [];   // tramo 2: sin valoración

  for (const d of doctors) {
    if (d.numReviews > 0 && d.rating > 0) {
      if (d.ratingKind === "center") tierCenter.push(d);
      else tierOwn.push(d);
    } else {
      tierNone.push(d);
    }
  }

  // C y m se calculan sobre todos los valorados (tramos 0+1) para que el prior
  // sea representativo del listado completo, independientemente de si la nota es
  // propia o prestada.
  const allRated = [...tierOwn, ...tierCenter];

  const prior =
    allRated.length >= 3
      ? allRated.reduce((s, d) => s + d.rating, 0) / allRated.length
      : RANK_PRIOR_FALLBACK;

  const m =
    allRated.length >= 3
      ? clamp(median(allRated.map((d) => d.numReviews)), RANK_M_MIN, RANK_M_MAX)
      : RANK_M_MIN;

  const scoreAndSort = (group: Doctor[]): Doctor[] => {
    const scored = group.map((d) => ({
      ...d,
      rankScore: bayesianScore(d.rating, d.numReviews, prior, m),
    }));
    scored.sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return b.numReviews - a.numReviews;
    });
    return scored;
  };

  tierNone.sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return [...scoreAndSort(tierOwn), ...scoreAndSort(tierCenter), ...tierNone];
}
