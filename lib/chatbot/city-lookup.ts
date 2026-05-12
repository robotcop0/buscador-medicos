import { doctors } from "@/data/doctors";

/** Normaliza para comparar ciudades: minúsculas, sin acentos, espacios colapsados. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let cache: Map<string, string> | null = null;

function build(): Map<string, string> {
  // ciudadNorm -> (cp -> nº de médicos con ese cp en esa ciudad)
  const counts = new Map<string, Map<string, number>>();
  for (const d of doctors) {
    if (!d.ciudad || !d.cp || !/^\d{5}$/.test(d.cp)) continue;
    const key = norm(d.ciudad);
    if (!key) continue;
    let m = counts.get(key);
    if (!m) {
      m = new Map();
      counts.set(key, m);
    }
    m.set(d.cp, (m.get(d.cp) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [city, m] of counts) {
    let bestCp = "";
    let bestN = -1;
    for (const [cp, n] of m) {
      if (n > bestN) {
        bestN = n;
        bestCp = cp;
      }
    }
    if (bestCp) out.set(city, bestCp);
  }
  return out;
}

/** Devuelve un CP representativo (el más frecuente) para una ciudad, o `null`. */
export function cityToCp(ciudad: string | undefined | null): string | null {
  if (!ciudad) return null;
  if (!cache) cache = build();
  return cache.get(norm(ciudad)) ?? null;
}
