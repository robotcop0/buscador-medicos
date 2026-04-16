/**
 * Cliente *live* de Allianz Salud (`buscador.allianzsalud.es`).
 *
 * Back-end operado por Asisa bajo el hash público `61fb2995...a191d0`.
 * Autenticación por session cookie `connect.sid` que se obtiene con una GET
 * simple a la home; cacheada en memoria del módulo.
 *
 * Flujo por búsqueda: 1 POST a `/search/list` con `provinceId` derivado del
 * CP y lat/lng resueltos via `coordsFromCP`.
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://buscador.allianzsalud.es";
// Hash público que identifica la red Allianz en la plataforma Asisa.
const HASH = process.env.ALLIANZ_HASH ?? "";
const NETWORK_ID = "168";
const PAGE_SIZE = 100;

type Medico = {
  ProviderId: number;
  Name: string;
  SpecialityName: string;
  SubSpecialityName: string | null;
  AddressType: string;
  AddressName: string;
  Number: string;
  Floor: string;
  Letter: string;
  PostalCode: string;
  City: string;
  ProvinceId: number;
  Latitude: number;
  Longitude: number;
  Phone1: number;
  Phone2: number;
  Phone3: number;
  ParentName: string | null;
  Distance: number;
};

let sessionCookie: string | null = null;
let sessionFetchedAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000;

async function getSessionCookie(): Promise<string | null> {
  if (sessionCookie && Date.now() - sessionFetchedAt < SESSION_TTL_MS) {
    return sessionCookie;
  }
  try {
    const r = await fetch(`${BASE}/`, { cache: "no-store" });
    const setCookie = r.headers.get("set-cookie");
    if (setCookie) {
      const m = setCookie.match(/connect\.sid=[^;]+/);
      if (m) {
        sessionCookie = m[0];
        sessionFetchedAt = Date.now();
      }
    }
  } catch {
    // Silent fallback — mandamos la request sin cookie, a veces también funciona.
  }
  return sessionCookie;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const cookie = await getSessionCookie();
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Allianz ${path}: ${r.status}`);
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

type EspCache = { all: string[]; primary: string[]; at: number };
const especialidadesCache: Map<number, EspCache> = new Map();
const ESP_TTL_MS = 60 * 60 * 1000;

async function getEspecialidades(provinceId: number): Promise<EspCache> {
  const cached = especialidadesCache.get(provinceId);
  if (cached && Date.now() - cached.at < ESP_TTL_MS) return cached;
  try {
    const j = await apiPost<{ collection: { Name: string; Type: number }[] }>(
      `/${HASH}/location/listSpecialities`,
      { forced: true, networkId: NETWORK_ID, provinceId }
    );
    const fresh: EspCache = {
      all: j.collection.map((e) => e.Name),
      primary: j.collection.filter((e) => e.Type === 1).map((e) => e.Name),
      at: Date.now(),
    };
    especialidadesCache.set(provinceId, fresh);
    return fresh;
  } catch {
    return { all: [], primary: [], at: Date.now() };
  }
}

async function resolveEspecialidad(especialidad: string, provinceId: number): Promise<string | null> {
  const { all } = await getEspecialidades(provinceId);
  if (all.length === 0) return null;
  const target = norm(especialidad);
  return (
    all.find((n) => norm(n) === target) ??
    all.find((n) => norm(n).startsWith(target)) ??
    all.find((n) => target.startsWith(norm(n))) ??
    all.find((n) => norm(n).includes(target)) ??
    all.find((n) => target.includes(norm(n))) ??
    null
  );
}

function normalizeText(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/,(\S)/g, ", $1")
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function buildAddress(m: Medico): string {
  const parts: string[] = [];
  if (m.AddressType) parts.push(m.AddressType);
  if (m.AddressName) parts.push(m.AddressName);
  let s = parts.join(" ");
  if (m.Number) s += `, Nº ${m.Number}`;
  if (m.Floor) s += `, ${m.Floor}`;
  if (m.Letter) s += ` ${m.Letter}`;
  return normalizeText(s);
}

function firstPhone(m: Medico): string | undefined {
  for (const p of [m.Phone1, m.Phone2, m.Phone3]) {
    if (p && p > 0) return String(p);
  }
  return undefined;
}

function toDoctor(m: Medico, offsetId: number): Doctor | null {
  if (!m.Name || !m.City) return null;
  return {
    id: offsetId,
    nombre: normalizeText(m.Name),
    especialidad: normalizeText(m.SpecialityName),
    mutuas: ["Allianz"],
    direccion: buildAddress(m),
    cp: (m.PostalCode || "").trim(),
    ciudad: normalizeText(m.City),
    telefono: firstPhone(m),
    rating: 0,
    numReviews: 0,
  };
}

async function queryOne(
  cp: string,
  provinceId: number,
  coords: { lat: number; lng: number },
  espName: string,
  pageSize = PAGE_SIZE
): Promise<Medico[]> {
  try {
    const j = await apiPost<{ collection: Medico[] }>(`/${HASH}/search/list`, {
      address: `CP ${cp}`,
      latitude: coords.lat,
      longitude: coords.lng,
      networkId: NETWORK_ID,
      networkName: "Allianz",
      ordenation: "Relevance",
      ordenationName: "Relevancia",
      pageNumber: 1,
      provinceId,
      totalResults: String(pageSize),
      speciality: espName,
      specialityName: espName,
      specialityType: 1,
    });
    return j.collection ?? [];
  } catch {
    return [];
  }
}

async function fanOut<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

export async function searchAllianz(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  if (!HASH) return [];

  const provinceId = parseInt(cp.slice(0, 2), 10);
  const coords = coordsFromCP(cp);
  if (!coords) return [];

  let allMedicos: Medico[] = [];

  if (especialidad) {
    // Ruta rápida: una sola especialidad.
    let espName: string | null = null;
    try {
      espName = await resolveEspecialidad(especialidad, provinceId);
    } catch {
      return [];
    }
    if (!espName) return [];
    allMedicos = await queryOne(cp, provinceId, coords, espName, PAGE_SIZE);
  } else {
    // Fan-out: sin especialidad, barremos todas las especialidades principales
    // (Type=1) de la provincia con concurrencia limitada.
    const { primary } = await getEspecialidades(provinceId);
    if (primary.length === 0) return [];
    const perEsp = 20; // resultados por especialidad
    const results = await fanOut(primary, 8, (name) =>
      queryOne(cp, provinceId, coords, name, perEsp)
    );
    allMedicos = results.flat();
  }

  // Dedup por ProviderId (una persona aparece en varias especialidades).
  const seen = new Set<number>();
  const deduped = allMedicos.filter((m) => {
    if (seen.has(m.ProviderId)) return false;
    seen.add(m.ProviderId);
    return true;
  });

  // IDs > 2e8 para no chocar con Adeslas (offline) ni Occident (1e8+).
  return deduped
    .map((m, i) => toDoctor(m, 200_000_000 + i))
    .filter((d): d is Doctor => d !== null);
}
