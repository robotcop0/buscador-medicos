/**
 * Regex compartida client/server para detectar si un `Doctor.nombre` es un
 * centro médico: centro / centre, clínica / clínic, hospital, policlínico /
 * policlinic, ambulatorio, laboratorio, instituto / institut, "mèdic"/"medic",
 * "medical", "asistencial"/"assistencial". Cubre las variantes catalanas
 * (sin la vocal final) porque muchas fuentes — Occident, IMQ, Fiatc… — usan
 * nomenclatura catalana. Vive en su propio fichero — sin imports de Node —
 * para poder consumirse desde componentes cliente sin arrastrar deps
 * server-only.
 *
 * Nota: para nombres de persona ("Apellido, Nombre") el match es siempre
 * negativo (ninguna de esas palabras aparece en esos nombres), y el rating de
 * Google solo se pide para centros — ver `lib/google-ratings-index.ts`.
 */
export const CENTER_RE =
  /\b(centr[eo]s?|cl[ií]nica?s?|hospital(es)?|policl[ií]nic[oa]?s?|ambulatorios?|laboratorios?|institut(?:os?|s)?|m[èe]dics?|medicals?|as?sistencials?)\b/i;

export function isCenter(nombre: string): boolean {
  return CENTER_RE.test(nombre);
}
