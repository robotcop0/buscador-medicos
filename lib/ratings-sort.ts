import type { Doctor } from "@/lib/types";

/**
 * Orden estándar del listado:
 * - Valorados (rating > 0 && numReviews > 0) primero, por **rating↓** y, en
 *   empate, por **distancia↑** (más cerca mejor). Si no hay CP, desempata
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
  rated.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
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
  return [...rated, ...unrated];
}
