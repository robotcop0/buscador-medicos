/**
 * Cliente *live* de Divina Pastora / Divina Seguros.
 *
 * Back-end en Azure App Service (`web-app-ws.azurewebsites.net/api/medicalteam`)
 * descubierto en el bundle Next.js de `divinaseguros.com/cuadromedico`. No
 * requiere auth — solo Content-Type `text/plain`. Taxonomía en `/source` y
 * búsqueda en `/search` con paginación por `offset` (15 items/página) y
 * filtro geográfico vía bbox (`southWestLatitude/Longitude`+`northEastLatitude/Longitude`).
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://web-app-ws.azurewebsites.net/api/medicalteam";
const CODE = "cmg"; // Cuadro médico general
const TYPE_ID = 11; // Variante general (12=Pla Bàsic, 13=Pla Plus; 11 cubre ambos planes de salud)
const PAGE_SIZE = 15; // fijo por el backend
const MAX_PAGES = 10; // 150 resultados por búsqueda es más que suficiente
const BBOX_HALF_DEG_LAT = 0.3; // ~33 km radio aprox para la búsqueda inicial
const BBOX_HALF_DEG_LNG = 0.4;

type SourceSpeciality = { id: number; name: string; child: unknown };
type SourceType = { type: number; name: string; specialities: SourceSpeciality[] };
type SourceRoot = { type: string; name: string; types: SourceType[] };

type Item = {
  serviceId: number;
  name: string;
  surname: string;
  medicalCenter: string | null;
  address: string | null;
  town: string | null;
  province: string | null;
  postalCode: string | null;
  telephone: string | null;
  telephone2: string | null;
  telephone3: string | null;
  email: string | null;
  mapLatitude: number | null;
  mapLongitude: number | null;
};

type SearchResponse = { numberOfResults: number; items: Item[] };

let especialidadesCache: SourceSpeciality[] | null = null;
let especialidadesFetchedAt = 0;
const ESP_TTL_MS = 60 * 60 * 1000;

async function getEspecialidades(): Promise<SourceSpeciality[]> {
  if (especialidadesCache && Date.now() - especialidadesFetchedAt < ESP_TTL_MS) {
    return especialidadesCache;
  }
  try {
    const r = await fetch(`${BASE}/source`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = (await r.json()) as SourceRoot[];
    const cmg = data.find((d) => d.type === CODE);
    const general = cmg?.types?.find((t) => t.type === TYPE_ID);
    especialidadesCache = general?.specialities ?? [];
    especialidadesFetchedAt = Date.now();
    return especialidadesCache;
  } catch {
    return [];
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSpecialityId(especialidad: string): Promise<number | null> {
  const list = await getEspecialidades();
  if (!list.length) return null;
  const target = norm(especialidad);
  const hit =
    list.find((e) => norm(e.name) === target) ??
    list.find((e) => norm(e.name).startsWith(target)) ??
    list.find((e) => target.startsWith(norm(e.name))) ??
    list.find((e) => norm(e.name).includes(target)) ??
    list.find((e) => target.includes(norm(e.name)));
  return hit?.id ?? null;
}

function normalizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

function buildName(it: Item): string {
  const parts = [it.name, it.surname].filter(Boolean).map((s) => s!.trim());
  const full = parts.join(" ").trim();
  if (full) return normalizeText(full);
  // Fallback: centro sin persona asociada
  return normalizeText(it.medicalCenter ?? "");
}

function firstPhone(it: Item): string | undefined {
  for (const p of [it.telephone, it.telephone2, it.telephone3]) {
    const v = (p ?? "").trim();
    if (v) return v;
  }
  return undefined;
}

async function searchBbox(
  specialityId: number,
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number }
): Promise<Item[]> {
  const out: Item[] = [];
  const seen = new Set<number>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set("medicalTeamCode", CODE);
    url.searchParams.set("medicalTeamTypeId", String(TYPE_ID));
    url.searchParams.set("specialityId", String(specialityId));
    url.searchParams.set("southWestLatitude", String(sw.lat));
    url.searchParams.set("southWestLongitude", String(sw.lng));
    url.searchParams.set("northEastLatitude", String(ne.lat));
    url.searchParams.set("northEastLongitude", String(ne.lng));
    if (page > 0) url.searchParams.set("offset", String(page * PAGE_SIZE));

    try {
      const r = await fetch(url.toString(), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        cache: "no-store",
      });
      if (!r.ok) break;
      const j = (await r.json()) as SearchResponse;
      const fresh = (j.items ?? []).filter((it) => !seen.has(it.serviceId));
      if (!fresh.length) break;
      fresh.forEach((it) => seen.add(it.serviceId));
      out.push(...fresh);
      if (fresh.length < PAGE_SIZE) break;
    } catch {
      break;
    }
  }
  return out;
}

function toDoctor(it: Item, offsetId: number, espLabel: string): Doctor | null {
  const nombre = buildName(it);
  if (!nombre) return null;
  return {
    id: offsetId,
    nombre,
    especialidad: normalizeText(espLabel),
    mutuas: ["Divina Pastora"],
    direccion: normalizeText(it.address ?? ""),
    cp: (it.postalCode ?? "").trim(),
    ciudad: normalizeText(it.town ?? ""),
    telefono: firstPhone(it),
    rating: 0,
    numReviews: 0,
  };
}

export async function searchDivinaPastora(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp) || !especialidad) return [];

  const coords = coordsFromCP(cp);
  if (!coords) return [];

  const specialityId = await resolveSpecialityId(especialidad);
  if (!specialityId) return [];

  const list = await getEspecialidades();
  const espLabel = list.find((e) => e.id === specialityId)?.name ?? especialidad;

  const sw = { lat: coords.lat - BBOX_HALF_DEG_LAT, lng: coords.lng - BBOX_HALF_DEG_LNG };
  const ne = { lat: coords.lat + BBOX_HALF_DEG_LAT, lng: coords.lng + BBOX_HALF_DEG_LNG };

  const items = await searchBbox(specialityId, sw, ne);

  // IDs > 3e8 para no chocar con offline (<1e6), Occident (1e8+), Allianz (2e8+).
  return items
    .map((it, i) => toDoctor(it, 300_000_000 + i, espLabel))
    .filter((d): d is Doctor => d !== null);
}
