/**
 * Filtro de relevancia compartido entre `/api/google-rating/route.ts` y
 * `lib/google-live-enrich.ts`. Protege contra resultados irrelevantes del
 * scraper de Google (p.ej. devolver "Santander" para "Hospital Santander":
 * misma palabra de ciudad, pero el resultado no es el hospital).
 *
 * Regla: al menos 1 token significativo en común entre el nombre buscado
 * y el resultado, descartando stop-words genéricas (centro, clínica,
 * hospital…). Si todo el nombre buscado son stop-words, caemos a un match
 * más laxo sobre todos los tokens.
 */

const STOPS = new Set<string>([
  "centro",
  "clinica",
  "clínica",
  "hospital",
  "policlinico",
  "policlínico",
  "ambulatorio",
  "medico",
  "médico",
  "medical",
  "salud",
  "adeslas",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function resultLooksRelevant(queryName: string, resultName: string): boolean {
  const q = new Set(tokenize(queryName).filter((t) => !STOPS.has(t)));
  const r = new Set(tokenize(resultName).filter((t) => !STOPS.has(t)));
  let shared = 0;
  for (const t of q) if (r.has(t)) shared++;
  if (q.size === 0) {
    const qAll = new Set(tokenize(queryName));
    const rAll = new Set(tokenize(resultName));
    for (const t of qAll) if (rAll.has(t)) return true;
    return false;
  }
  return shared >= 1;
}
