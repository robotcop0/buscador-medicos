import type { Doctor } from "@/lib/types";

/**
 * Fusiona ratings de Doctoralia (ya aplicados a `rating`/`numReviews` por
 * `enrichWithDoctoralia`) con ratings de Google (en `googleRating`/
 * `googleNumReviews` por `enrichWithGoogle`).
 *
 * Cuando ambas fuentes tienen datos, calcula la media ponderada por número
 * de reseñas. Los raw values de cada fuente se conservan para que la UI
 * pueda mostrar la procedencia si quisiera.
 */
export function mergeRatings(doctor: Doctor): Doctor {
  const gR = doctor.googleRating ?? 0;
  const gN = doctor.googleNumReviews ?? 0;
  const hasGoogle = gR > 0 && gN > 0;

  const dR = doctor.doctoraliaUrl ? doctor.rating : 0;
  const dN = doctor.doctoraliaUrl ? doctor.numReviews : 0;
  const hasDoctoralia = dR > 0 && dN > 0;

  if (!hasGoogle) return doctor;

  if (!hasDoctoralia) {
    return {
      ...doctor,
      rating: gR,
      numReviews: gN,
    };
  }

  const totalN = gN + dN;
  const weighted = (gR * gN + dR * dN) / totalN;
  return {
    ...doctor,
    rating: Math.round(weighted * 10) / 10,
    numReviews: totalN,
  };
}
