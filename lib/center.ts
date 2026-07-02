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
 *
 * Grupos adicionales:
 *
 * - Palabras genéricas que son siempre entidades (no apellidos):
 *   gabinete, unidad, grupo (médico/sanitario), servicios, diagnóstico/diagnostic,
 *   análisis, mutua, oftalm* (oftalmología/oftalmológico), fisio* compuesto.
 *
 * - Marcas/cadenas sanitarias españolas que NO contienen keyword genérica:
 *   Recoletas (Castilla y León), Megalab / Eurofins (labs), Vithas (hospitales),
 *   Synlab (labs), Cerba (labs), Ascires (labs), Quironsalud (hospitales),
 *   Adeslas (franquicia dental). Todas verificadas contra el dataset para
 *   confirmar que NO aparecen como apellidos de personas.
 *   — Ribera EXCLUIDA: apellido frecuente (ej. "Dra. Ribera Tello, Silvia").
 *   — Juaneda EXCLUIDA como global: apellido real (ej. "Dra. Juaneda Castell, Begoña").
 *   — Quirón (sin "salud") EXCLUIDO: aparece embebido en notas de persona.
 */
export const CENTER_RE =
  /\b(centr[eo]s?|cl[ií]nica?s?|hospital(es)?|policl[ií]nic[oa]?s?|ambulatorios?|laboratorios?|institut(?:os?|s)?|m[èe]dics?|medicals?|as?sistencials?|gabinetes?|unidades?|grupos?|servicios|diagn[oó]stic[oa]?s?|an[aá]lisis|mutua|oftalm[ao]\w*|fisioter\w*|fisio[a-z]\w*|recoletas|megalab|vithas|eurofins|synlab|cerba|ascires|quironsalud|adeslas)\b/i;

export function isCenter(nombre: string): boolean {
  return CENTER_RE.test(nombre);
}
