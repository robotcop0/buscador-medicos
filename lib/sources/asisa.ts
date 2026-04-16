/**
 * Cliente *live* de Asisa (`www.asisa.es/cuadro-medico`).
 *
 * Back-end AEM (`/content/wasisa/.../results.search.html`) con SSR de tarjetas
 * como HTML. Sin auth — hay que pasar el set completo de params: `networkName`,
 * `ordination`/`ordinationName` y `specialityType` (omitir cualquiera provoca
 * "No pudimos conectar"). Autocompletes bajo `/bin/wasisa/autocomplete-*`.
 *
 * Paginación: 6 items/página vía `.results.html?page=N`. Limitamos a 8 páginas
 * (~48 médicos) para mantener latencia aceptable.
 *
 * El backend soporta distintas redes (networkId) para los planes concertados:
 *   1 = Salud (pólizas de salud normales)
 *   2 = MUFACE    3 = ISFAS    4 = MUGEJU
 * Exportamos `searchAsisa()` (Salud) y `searchAsisaMuface()` que comparten
 * internamente la lógica vía `searchAsisaNetwork()`.
 */
import { coordsFromCP } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://www.asisa.es";
const RESULTS_PATH = "/content/wasisa/es/cuadro-medico/resultados-cuadro-medico/jcr:content/root/container/container/results";
const PAGE_SIZE = 6; // fijo por el backend AEM
const MAX_PAGES = 8; // ~48 resultados; suficiente para las vistas típicas

type Network = { id: string; name: string; mutuaLabel: string; idOffset: number };

const NETWORK_SALUD: Network = { id: "1", name: "Salud", mutuaLabel: "Asisa", idOffset: 400_000_000 };
const NETWORK_MUFACE: Network = { id: "2", name: "MUFACE", mutuaLabel: "MUFACE", idOffset: 500_000_000 };

type Card = {
  "medical-title": string;
  "complete-address": string;
  "medical-phone": string;
  latitude: string;
  longitude: string;
  "medical-speciality": string;
};

type EspCache = { all: { Name: string; Type: number }[]; at: number };
const especialidadesCache: Map<string, EspCache> = new Map();
const ESP_TTL_MS = 60 * 60 * 1000;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEspecialidades(networkId: string, provinceId: number): Promise<EspCache> {
  const key = `${networkId}::${provinceId}`;
  const cached = especialidadesCache.get(key);
  if (cached && Date.now() - cached.at < ESP_TTL_MS) return cached;
  try {
    const url = `${BASE}/bin/wasisa/autocomplete-specialities?q=&networkId=${networkId}&provinceId=${provinceId}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status}`);
    const list = (await r.json()) as { Name: string; Type: number }[];
    const fresh: EspCache = { all: list, at: Date.now() };
    especialidadesCache.set(key, fresh);
    return fresh;
  } catch {
    return { all: [], at: Date.now() };
  }
}

async function resolveEspecialidad(
  especialidad: string,
  networkId: string,
  provinceId: number
): Promise<{ name: string; type: number } | null> {
  const { all } = await getEspecialidades(networkId, provinceId);
  if (!all.length) return null;
  const target = norm(especialidad);
  const hit =
    all.find((e) => norm(e.Name) === target) ??
    all.find((e) => norm(e.Name).startsWith(target)) ??
    all.find((e) => target.startsWith(norm(e.Name))) ??
    all.find((e) => norm(e.Name).includes(target)) ??
    all.find((e) => target.includes(norm(e.Name)));
  return hit ? { name: hit.Name, type: hit.Type } : null;
}

function buildQueryString(params: {
  network: Network;
  cp: string;
  provinceId: number;
  coords: { lat: number; lng: number };
  espName: string;
  espType: number;
}): string {
  const qs = new URLSearchParams({
    networkId: params.network.id,
    networkName: params.network.name,
    ordination: "Relevance",
    ordinationName: "Relevancia",
    address: `${params.cp} España`,
    latitude: String(params.coords.lat),
    longitude: String(params.coords.lng),
    provinceId: String(params.provinceId),
    speciality: params.espName,
    specialityName: params.espName,
    specialityType: String(params.espType),
  });
  return qs.toString();
}

function extractCards(html: string): Card[] {
  const cards: Card[] = [];
  let startIdx = 0;
  while (true) {
    const i = html.indexOf("data-medical-picture-result-card", startIdx);
    if (i === -1) break;
    const openStart = html.lastIndexOf("<", i);
    const openEnd = html.indexOf(">", i);
    if (openStart < 0 || openEnd < 0) break;
    const openTag = html.slice(openStart, openEnd + 1);
    const attrs: Record<string, string> = {};
    for (const m of openTag.matchAll(/data-([a-zA-Z\-]+)="([^"]*)"/g)) {
      attrs[m[1]] = m[2];
    }
    cards.push(attrs as Card);
    startIdx = openEnd + 1;
  }
  return cards;
}

function normalizeText(raw: string): string {
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

function parseAddress(complete: string): { direccion: string; cp: string; ciudad: string } {
  const parts = complete.split(",").map((s) => s.trim());
  const cpMatch = parts.find((p) => /^\d{5}$/.test(p));
  const cp = cpMatch ?? "";
  const nonCp = parts.filter((p) => p !== cpMatch);
  const ciudad = nonCp.length >= 2 ? nonCp[nonCp.length - 1] : "";
  const direccion = nonCp.length >= 2 ? nonCp.slice(0, -1).join(", ") : nonCp[0] ?? "";
  return { direccion: normalizeText(direccion), cp, ciudad: normalizeText(ciudad) };
}

function cardToDoctor(c: Card, offsetId: number, mutuaLabel: string): Doctor | null {
  const nombre = normalizeText(c["medical-title"] ?? "");
  if (!nombre) return null;
  const { direccion, cp, ciudad } = parseAddress(c["complete-address"] ?? "");
  const phone = (c["medical-phone"] ?? "").trim();
  return {
    id: offsetId,
    nombre,
    especialidad: normalizeText(c["medical-speciality"] ?? ""),
    mutuas: [mutuaLabel],
    direccion,
    cp,
    ciudad,
    telefono: phone || undefined,
    rating: 0,
    numReviews: 0,
  };
}

async function fetchPage(baseQs: string, page: number): Promise<Card[]> {
  const selector = page === 1 ? ".search.html" : ".results.html";
  const pageParam = page === 1 ? "" : `&page=${page}`;
  const url = `${BASE}${RESULTS_PATH}${selector}?${baseQs}${pageParam}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const html = await r.text();
    return extractCards(html);
  } catch {
    return [];
  }
}

async function searchAsisaNetwork(cp: string, especialidad: string, network: Network): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp) || !especialidad) return [];

  const provinceId = parseInt(cp.slice(0, 2), 10);
  const coords = coordsFromCP(cp);
  if (!coords) return [];

  const esp = await resolveEspecialidad(especialidad, network.id, provinceId);
  if (!esp) return [];

  const baseQs = buildQueryString({ network, cp, provinceId, coords, espName: esp.name, espType: esp.type });

  const pageNumbers = Array.from({ length: MAX_PAGES }, (_, i) => i + 1);
  const pages = await Promise.all(pageNumbers.map((p) => fetchPage(baseQs, p)));

  const seen = new Set<string>();
  const unique: Card[] = [];
  for (const page of pages) {
    for (const c of page) {
      const key = `${c["medical-title"]}|${c["complete-address"]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
    if (page.length < PAGE_SIZE) break;
  }

  return unique
    .map((c, i) => cardToDoctor(c, network.idOffset + i, network.mutuaLabel))
    .filter((d): d is Doctor => d !== null);
}

export async function searchAsisa(cp: string, especialidad: string): Promise<Doctor[]> {
  return searchAsisaNetwork(cp, especialidad, NETWORK_SALUD);
}

export async function searchAsisaMuface(cp: string, especialidad: string): Promise<Doctor[]> {
  return searchAsisaNetwork(cp, especialidad, NETWORK_MUFACE);
}
