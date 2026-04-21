/**
 * Regex compartida client/server para detectar si un `Doctor.nombre` es un
 * centro médico (clínica, hospital, policlínico, ambulatorio, laboratorio,
 * instituto, centro médico). Vivida en su propio fichero — sin imports de
 * Node — para poder ser consumida desde componentes cliente sin arrastrar
 * dependencias server-only.
 */
export const CENTER_RE =
  /\b(centros?|cl[ií]nicas?|hospital(es)?|policl[ií]nicos?|ambulatorios?|laboratorios?|institutos?|centres?)\b/i;

export function isCenter(nombre: string): boolean {
  return CENTER_RE.test(nombre);
}
