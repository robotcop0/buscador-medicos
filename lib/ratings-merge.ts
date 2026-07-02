import type { Doctor } from "@/lib/types";
import { isCenter } from "@/lib/center";

/**
 * Fusiona ratings de Doctoralia (ya aplicados a `rating`/`numReviews` por
 * `enrichWithDoctoralia`) con ratings de Google (en `googleRating`/
 * `googleNumReviews` por `enrichWithGoogle`), aplicando la siguiente
 * precedencia:
 *
 * PERSONA:
 *   1. Tiene Doctoralia → usa Doctoralia (own/doctoralia). Google se ignora.
 *   2. No Doctoralia, Google kind:"own" → usa Google (own/google).
 *   3. No Doctoralia, Google kind:"center" → usa la nota del centro (center/google + centerName).
 *
 * CENTRO:
 *   - Ambas fuentes → media ponderada por numReviews (own/both).
 *   - Solo una fuente → esa fuente (own/<fuente>).
 *   - Ninguna → sin cambios.
 *
 * `ratingKind`, `ratingSource`, `ratingCenterName` quedan anotados para que
 * la UI pueda mostrar la procedencia. `rankScore` lo calcula `sortByRating`
 * más tarde — aquí no se toca.
 */
export function mergeRatings(doctor: Doctor): Doctor {
  const gR = doctor.googleRating ?? 0;
  const gN = doctor.googleNumReviews ?? 0;
  const hasGoogle = gR > 0 && gN > 0;

  // Detectamos presencia de Doctoralia por doctoraliaUrl (igual que antes):
  // enrichWithDoctoralia ya habrá poblado rating/numReviews desde el índice,
  // pero solo cuando doctoraliaUrl está presente podemos confiar en que los
  // valores de rating/numReviews son de Doctoralia (y no los 0 del dataset raw).
  const dR = doctor.doctoraliaUrl ? doctor.rating : 0;
  const dN = doctor.doctoraliaUrl ? doctor.numReviews : 0;
  const hasDoctoralia = dR > 0 && dN > 0;

  if (isCenter(doctor.nombre)) {
    // ── CENTRO ──────────────────────────────────────────────────────────────
    if (!hasGoogle) {
      // Sin Google: si tiene Doctoralia, marcamos fuente; si no, sin cambios.
      if (hasDoctoralia) {
        return {
          ...doctor,
          ratingKind: "own",
          ratingSource: "doctoralia",
          ratingCenterName: undefined,
        };
      }
      return doctor;
    }

    if (!hasDoctoralia) {
      // Solo Google.
      return {
        ...doctor,
        rating: gR,
        numReviews: gN,
        ratingKind: "own",
        ratingSource: "google",
        ratingCenterName: undefined,
      };
    }

    // Ambas fuentes → media ponderada.
    const totalN = gN + dN;
    const weighted = (gR * gN + dR * dN) / totalN;
    return {
      ...doctor,
      rating: Math.round(weighted * 10) / 10,
      numReviews: totalN,
      ratingKind: "own",
      ratingSource: "both",
      ratingCenterName: undefined,
    };
  } else {
    // ── PERSONA ─────────────────────────────────────────────────────────────
    if (hasDoctoralia) {
      // Doctoralia tiene prioridad absoluta para personas.
      return {
        ...doctor,
        ratingKind: "own",
        ratingSource: "doctoralia",
        ratingCenterName: undefined,
      };
    }

    if (!hasGoogle) return doctor;

    // Sin Doctoralia; usamos Google según el kind que enrichWithGoogle anotó.
    const kind = doctor.ratingKind ?? "own"; // enrichWithGoogle lo habrá puesto
    if (kind === "center") {
      return {
        ...doctor,
        rating: gR,
        numReviews: gN,
        ratingKind: "center",
        ratingSource: "google",
        // ratingCenterName ya lo habrá puesto enrichWithGoogle; lo conservamos.
      };
    }

    // kind === "own": listing propio del médico en Google.
    return {
      ...doctor,
      rating: gR,
      numReviews: gN,
      ratingKind: "own",
      ratingSource: "google",
      ratingCenterName: undefined,
    };
  }
}
