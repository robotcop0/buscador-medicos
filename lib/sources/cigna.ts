/**
 * Cliente *live* de Cigna — consultado desde `lib/search.ts` en tiempo de búsqueda.
 *
 * Endpoint público `https://directorio-medico.cigna.es/dm/api/...`. No requiere
 * auth; sirve JSON directo. Estrategia: autocompletar la especialidad escrita
 * por el usuario para obtener el nombre canónico (ej. "Cardiología" →
 * "CARDIOLOGÍA"), y consultar `providers/advanced-search` con
 * `postalCode=<CP>&filterSpecialtyMedicalAct.name=<NAME>&filterSpecialtyMedicalAct.type=<TYPE>`.
 *
 * El listado de especialidades normalizadas se cachea en memoria del módulo.
 */
import type { Doctor } from "@/lib/types";

const BASE = "https://directorio-medico.cigna.es/dm/api";

type SpecialtyHit = {
  type: "SPECIALTY" | "MEDICAL_ACT";
  catalogId: string;
  language_ES: string;
  language_EN?: string;
};

type Address = {
  provider?: string;
  address?: string;
  city?: string;
  county?: string;
  postcd?: string;
  phone1?: string;
  phone2?: string;
  geoPoint?: { lat: number; lon: number };
  specialties?: Array<{ language_ES?: string; language_EN?: string }>;
};

type Provider = {
  id: string;
  name: string;
  prvtyp?: string;
  destprov?: string;
  addresses?: Address[];
};

type SearchResponse = {
  content?: Provider[];
  pageable?: { totalElements?: number };
};

const specialtyCache = new Map<string, SpecialtyHit | null>();

async function resolveSpecialty(raw: string): Promise<SpecialtyHit | null> {
  const key = raw.trim().toLowerCase();
  if (specialtyCache.has(key)) return specialtyCache.get(key) ?? null;

  // Mapa manual para especialidades de la UI que no coinciden literalmente con
  // el catálogo Cigna (nombres más largos o con barras).
  const SYNONYMS: Record<string, string> = {
    pediatria: "pediatria",
    "medicina de urgencias": "urgencias",
    traumatologia: "traumatologia",
    ginecologia: "obstetricia y ginecologia",
    odontologia: "estomatologia",
    "nutricion y dietetica": "nutricion",
    "cirugia general": "cirugia general",
    "cirugia plastica": "cirugia plastica",
  };

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const query = SYNONYMS[norm(raw)] ?? norm(raw);

  try {
    const url = `${BASE}/auto-complete/specialties-medicalacts?searchType=all&searchRequestIn=${encodeURIComponent(
      query
    )}&outpatient=null&size=10&language=ES&publishable=true`;
    const r = await fetch(url, {
      headers: { accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    if (!r.ok) {
      specialtyCache.set(key, null);
      return null;
    }
    const list = (await r.json()) as SpecialtyHit[];
    // Preferir SPECIALTY; si no, el primer MEDICAL_ACT; y dentro de cada
    // grupo, preferir match exacto por nombre normalizado.
    const byExact = list.find(
      (s) => norm(s.language_ES || "") === norm(raw)
    );
    if (byExact) {
      specialtyCache.set(key, byExact);
      return byExact;
    }
    const firstSpec = list.find((s) => s.type === "SPECIALTY");
    const chosen = firstSpec ?? list[0] ?? null;
    specialtyCache.set(key, chosen);
    return chosen;
  } catch {
    specialtyCache.set(key, null);
    return null;
  }
}

function toTitleCase(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function flattenProviders(data: SearchResponse, especialidad: SpecialtyHit): Doctor[] {
  const out: Doctor[] = [];
  const targetEs = especialidad.language_ES?.toUpperCase() || "";
  let idx = 0;
  for (const p of data.content ?? []) {
    for (const a of p.addresses ?? []) {
      // Saltamos los "Consulta Digital" ficticios que no tienen CP/telefono útiles
      // en la provincia del usuario (sus addresses están siempre en BCN/SEV).
      if ((p.name || "").toLowerCase().startsWith("consulta digital")) continue;

      const cp = (a.postcd || "").trim();
      const tel = (a.phone1 || "").replace(/\D/g, "");
      // Buscar la especialidad concreta entre las del provider para mostrarla.
      const matchedSpec =
        a.specialties?.find(
          (s) => (s.language_ES || "").toUpperCase() === targetEs
        )?.language_ES || especialidad.language_ES;

      out.push({
        // Offsets >= 1e8 para no chocar con el dataset offline. Cada mutua live
        // reserva un rango: Occident 1.0e8, Allianz ~1.1e8, etc. Usamos 1.6e8
        // para Cigna.
        id: 160_000_000 + idx++,
        nombre: toTitleCase((p.name || "").replace(/,(\S)/g, ", $1")),
        especialidad: toTitleCase(matchedSpec || ""),
        mutuas: ["Cigna"],
        direccion: toTitleCase((a.address || "").replace(/\s*,\s*,\s*$/, "")),
        cp,
        ciudad: toTitleCase(a.city || ""),
        telefono: tel || undefined,
        rating: 0,
        numReviews: 0,
      });
    }
  }
  return out;
}

export async function searchCigna(
  cp: string,
  especialidad: string
): Promise<Doctor[]> {
  if (!especialidad || !cp || !/^\d{5}$/.test(cp)) return [];

  const spec = await resolveSpecialty(especialidad);
  if (!spec) return [];

  const params = new URLSearchParams({
    postalCode: cp,
    "filterSpecialtyMedicalAct.name": spec.language_ES,
    "filterSpecialtyMedicalAct.type": spec.type,
    limit: "50",
    offset: "0",
    orderType: "DEFAULT",
    directionSort: "DESC",
    publishable: "true",
    language: "ES",
  });

  try {
    const r = await fetch(`${BASE}/providers/advanced-search?${params.toString()}`, {
      headers: { accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = (await r.json()) as SearchResponse;
    return flattenProviders(data, spec);
  } catch {
    return [];
  }
}
