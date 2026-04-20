/**
 * Cliente *live* de Sanitas (`api.sanitas.es`).
 *
 * API pública con Apikey hardcodeada en el cliente web (MSWeb). Es la única
 * fuente que devuelve **valoración real** (puntuación 0-10 + votos).
 *
 * Flujo por búsqueda: resolver especialidad → id, CP → provincia INE, pedir
 * /especialistas y expandir cada médico a un registro por centro.
 */
import { normalizeCp } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const API = "https://api.sanitas.es/is-cuadro-medico-publico/api/v2";
const PAGE_SIZE = 50;

// Apikey pública extraída del cliente MSWeb. Configurar `SANITAS_APIKEY`.
const SANITAS_APIKEY = process.env.SANITAS_APIKEY ?? "";
const HEADERS: Record<string, string> = {
  authorization: `Apikey ${SANITAS_APIKEY}`,
  "snt-caller-id": "MSWeb",
  "snt-caller-version": "2.62.2",
  "snt-caller-language": "es_ES",
  accept: "application/json, text/plain, */*",
};

type Especialidad = { id: number; nombre: string };
type Centro = {
  id: string | null;
  nombre: string;
  poblacion?: { nombre: string };
  provincia?: { id: number; nombre: string };
  codigoPostal?: string;
  domicilio?: string;
  geolocalizacion?: { lat: number; lon: number };
  valoracion?: { puntuacion?: number; votos?: number };
  telefono?: string;
};
type Especialista = {
  id: number;
  nombre: string;
  titulo?: string;
  especialidades?: { nombre: string; centros?: Centro[] }[];
};

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${API}${path}?${qs}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Sanitas ${path}: ${r.status}`);
  return (await r.json()) as T;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let especialidadesCache: Especialidad[] | null = null;
let especialidadesFetchedAt = 0;
const ESP_TTL_MS = 60 * 60 * 1000;

async function getEspecialidades(): Promise<Especialidad[]> {
  if (especialidadesCache && Date.now() - especialidadesFetchedAt < ESP_TTL_MS) {
    return especialidadesCache;
  }
  try {
    const j = await apiGet<{ resultados: Especialidad[] }>("/especialidades", {});
    especialidadesCache = j.resultados ?? [];
    especialidadesFetchedAt = Date.now();
    return especialidadesCache;
  } catch {
    return [];
  }
}

async function resolveEspecialidadId(especialidad: string): Promise<number | null> {
  const list = await getEspecialidades();
  if (list.length === 0) return null;
  const target = norm(especialidad);
  const match =
    list.find((e) => norm(e.nombre) === target) ??
    list.find((e) => norm(e.nombre).startsWith(target)) ??
    list.find((e) => target.startsWith(norm(e.nombre))) ??
    list.find((e) => norm(e.nombre).includes(target)) ??
    list.find((e) => target.includes(norm(e.nombre))); // p.ej. "aparato digestivo" → "Digestivo"
  return match?.id ?? null;
}

function capitalize(raw: string): string {
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

function ratingFromSanitas(valoracion?: { puntuacion?: number; votos?: number }): {
  rating: number;
  numReviews: number;
} {
  if (!valoracion) return { rating: 0, numReviews: 0 };
  // Sanitas usa escala 0-10; normalizamos a 0-5.
  const rating =
    valoracion.puntuacion != null ? Math.min(5, Math.max(0, valoracion.puntuacion / 2)) : 0;
  return { rating, numReviews: valoracion.votos ?? 0 };
}

function buildName(e: Especialista): string {
  const n = (e.nombre || "").replace(/,(\S)/g, ", $1");
  return capitalize(n);
}

function toDoctorRecords(e: Especialista, offsetStart: number): Doctor[] {
  const docs: Doctor[] = [];
  const nombre = buildName(e);
  let idx = 0;
  for (const esp of e.especialidades ?? []) {
    const espNombre = capitalize(esp.nombre || "");
    for (const c of esp.centros ?? []) {
      if (!c.codigoPostal) continue;
      const { rating, numReviews } = ratingFromSanitas(c.valoracion);
      docs.push({
        id: offsetStart + idx++,
        nombre: nombre || capitalize(c.nombre),
        especialidad: espNombre,
        mutuas: ["Sanitas"],
        direccion: capitalize(c.domicilio || ""),
        cp: normalizeCp(c.codigoPostal),
        ciudad: capitalize(c.poblacion?.nombre || c.provincia?.nombre || ""),
        telefono: c.telefono ? c.telefono.replace(/\D/g, "") : undefined,
        rating,
        numReviews,
      });
    }
  }
  return docs;
}

async function fetchEspecialistas(params: {
  especialidadId?: number;
  provinciaCod: number;
  pagina: number;
}): Promise<{ resultados: Especialista[]; total: number }> {
  try {
    const query: Record<string, string> = {
      provincias: String(params.provinciaCod),
      "paginacion.numItems": String(PAGE_SIZE),
      "paginacion.numPagina": String(params.pagina),
      "detalle.orden": "RELEVANCIA",
      "detalle.nivelDetalle": "RESUMIDO",
      "detalle.infoFiltros": "false",
    };
    if (params.especialidadId) query.especialidades = String(params.especialidadId);
    const j = await apiGet<{
      paginacion?: { total?: number };
      resultados?: Especialista[];
    }>("/especialistas", query);
    return {
      resultados: j.resultados ?? [],
      total: j.paginacion?.total ?? 0,
    };
  } catch {
    return { resultados: [], total: 0 };
  }
}

export async function searchSanitas(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  if (!SANITAS_APIKEY) return [];
  const provinciaCod = parseInt(cp.slice(0, 2), 10);

  let especialidadId: number | undefined;
  if (especialidad) {
    const id = await resolveEspecialidadId(especialidad).catch(() => null);
    if (!id) return [];
    especialidadId = id;
  }

  // Pedimos primera página (50 resultados por página es suficiente para la UX
  // de un CP+especialidad). Sin especialidad Sanitas probablemente limita a
  // los más relevantes igualmente.
  const { resultados } = await fetchEspecialistas({
    especialidadId,
    provinciaCod,
    pagina: 0,
  });

  // IDs > 4e8 para no chocar con Adeslas/Occident/Allianz/Mapfre.
  const docs: Doctor[] = [];
  let cursor = 400_000_000;
  for (const e of resultados) {
    const batch = toDoctorRecords(e, cursor);
    cursor += batch.length;
    docs.push(...batch);
  }

  // Dedup por nombre+cp (mismo médico repetido raramente, pero posible si
  // tiene varios centros con mismo CP).
  const seen = new Set<string>();
  return docs.filter((d) => {
    const key = `${d.nombre}::${d.cp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
