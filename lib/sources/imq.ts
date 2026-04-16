/**
 * Cliente *live* de IMQ — `www.imq.es/corporativo/es_ES/particular/guia-medica`.
 *
 * IMQ (Igualatorio Médico Quirúrgico) sólo cubre 5 provincias: Araba (01),
 * Bizkaia (48), Burgos (09), Gipuzkoa (20) y Cantabria (39). CP fuera de esas
 * provincias devuelve [] silenciosamente.
 *
 * El buscador es un form SSR que POSTea a
 * `/sites/dynamic/corporativo/GuiaMedica/submit` y responde HTML con las cards
 * de médicos marcadas con `data-marker-*` (título, descripción, address,
 * phone, lat/lng). Paginación en DOM (no hay `totalElements` expuesto).
 *
 * Taxonomía de especialidades cacheada en memoria desde
 * `/sites/dynamic/guiaMedica/especialidades`.
 */
import type { Doctor } from "@/lib/types";

const BASE = "https://www.imq.es";
const SUBMIT_URL = `${BASE}/sites/dynamic/corporativo/GuiaMedica/submit`;
const ESPECIALIDADES_URL = `${BASE}/sites/dynamic/guiaMedica/especialidades`;

// Provincias cubiertas: prefijo CP → id IMQ (usado por el combobox).
const CP_PREFIX_TO_IMQ_PROVINCE: Record<string, string> = {
  "01": "1",   // ARABA
  "48": "48",  // BIZKAIA
  "09": "9",   // BURGOS
  "20": "20",  // GIPUZKOA
  "39": "39",  // CANTABRIA
};

export const IMQ_COVERAGE_LABEL =
  "Araba, Bizkaia, Gipuzkoa, Cantabria y Burgos";

export function imqCoversCp(cp: string): boolean {
  if (!cp || !/^\d{5}$/.test(cp)) return false;
  return !!CP_PREFIX_TO_IMQ_PROVINCE[cp.slice(0, 2)];
}

type Especialidad = { esId: number; esDesc: string };

let especialidadesCache: Especialidad[] | null = null;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEspecialidades(): Promise<Especialidad[]> {
  if (especialidadesCache) return especialidadesCache;
  try {
    const r = await fetch(ESPECIALIDADES_URL, {
      headers: { accept: "application/json, */*" },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const list = (await r.json()) as Especialidad[];
    especialidadesCache = list.filter((e) => e.esId && e.esDesc);
    return especialidadesCache;
  } catch {
    return [];
  }
}

// Sinónimos UI → catálogo IMQ (las entradas usan mayúsculas sin acentos).
const SYNONYMS: Record<string, string> = {
  "medicina de urgencias": "urgencias",
  "nutricion y dietetica": "endocrinologia y nutricion",
  "cirugia general": "cirugia general y del aparato digestivo",
  "cirugia plastica": "cirugia plastica estetica y reparadora",
  odontologia: "estomatologia",
};

async function resolveEspecialidadId(especialidad: string): Promise<Especialidad | null> {
  const list = await getEspecialidades();
  if (!list.length) return null;
  const raw = normalize(especialidad);
  const target = SYNONYMS[raw] ?? raw;

  const exact = list.find((e) => normalize(e.esDesc) === target);
  if (exact) return exact;
  const prefix = list.find((e) => normalize(e.esDesc).startsWith(target));
  if (prefix) return prefix;
  const reverse = list.find((e) => target.startsWith(normalize(e.esDesc)));
  if (reverse) return reverse;
  const includes = list.find((e) => normalize(e.esDesc).includes(target));
  return includes ?? null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

type ParsedMarker = {
  nombre: string;
  especialidad: string;
  direccion: string;
  cp: string;
  ciudad: string;
  telefono?: string;
};

// Extrae un CP español (5 dígitos) y la ciudad del string del data-marker-address.
// Formato observado: "Calle X 24, 48010, Bilbao, Bizkaia (CLINICA Y)".
function parseAddress(raw: string): { direccion: string; cp: string; ciudad: string } {
  const clean = decodeHtmlEntities(raw).trim();
  const cpMatch = clean.match(/\b(\d{5})\b/);
  const cp = cpMatch?.[1] ?? "";
  // Tras el CP viene ", <Ciudad>, ..."; cogemos la primera parte.
  let ciudad = "";
  if (cpMatch) {
    const rest = clean.slice(cpMatch.index! + 5).replace(/^[,\s]+/, "");
    ciudad = rest.split(",")[0]?.trim() ?? "";
  }
  // Dirección = todo lo anterior al CP, sin la coma final.
  const direccion = cpMatch
    ? clean.slice(0, cpMatch.index!).replace(/[,\s]+$/, "").trim()
    : clean;
  return { direccion, cp, ciudad };
}

function extractMarkers(html: string): ParsedMarker[] {
  const out: ParsedMarker[] = [];
  // Cada <li class="data-map-marker" ...> lleva los datos en atributos data-*.
  const liRegex = /<li[^>]*class="data-map-marker"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(html))) {
    const tag = m[0];
    const attr = (name: string): string => {
      const re = new RegExp(`${name}="([^"]*)"`, "i");
      return decodeHtmlEntities(tag.match(re)?.[1] ?? "");
    };
    const nombre = attr("data-marker-title");
    if (!nombre) continue;
    const especialidad = attr("data-marker-description");
    const address = attr("data-marker-address");
    const phone = attr("data-marker-phone");
    const { direccion, cp, ciudad } = parseAddress(address);
    out.push({
      nombre,
      especialidad,
      direccion,
      cp,
      ciudad,
      telefono: phone?.replace(/\D/g, "") || undefined,
    });
  }
  return out;
}

function capitalize(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bY\b/g, "y");
}

export async function searchImq(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!especialidad) return [];
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  if (!CP_PREFIX_TO_IMQ_PROVINCE[cp.slice(0, 2)]) return [];

  const esp = await resolveEspecialidadId(especialidad);
  if (!esp) return [];

  const provinceId = CP_PREFIX_TO_IMQ_PROVINCE[cp.slice(0, 2)];

  // Usamos `nombre_centro-medico` (provincia completa) en lugar de `cod_postal`
  // porque el endpoint CP filtra por proximidad estricta (radio muy pequeño) y
  // devuelve 0 resultados para CPs periféricos de la propia provincia (ej.
  // 20301 en Gipuzkoa). La búsqueda por provincia devuelve la lista completa;
  // el geo-filtering por CP/radio lo aplica luego `applyGeo` en lib/search.ts.
  const body = new URLSearchParams({
    searchBy: "nombre_centro-medico",
    "centerForm.name": "",
    "centerForm.province": provinceId,
    "centerForm.location": "",
    "centerForm.speciality": String(esp.esId),
    "centerForm.medicalCenter": "",
    "centerForm.mutual": "true",
    "_centerForm.mutual": "on",
    "_centerForm.dental": "on",
    "_centerForm.citaOnline": "on",
  });

  let html: string;
  try {
    const r = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html, */*",
      },
      body: body.toString(),
      cache: "no-store",
    });
    if (!r.ok) return [];
    html = await r.text();
  } catch {
    return [];
  }

  const markers = extractMarkers(html);
  // IDs >= 7e8 para separarnos de las otras fuentes live.
  return markers.map((mk, i) => ({
    id: 700_000_000 + i,
    nombre: capitalize(mk.nombre),
    especialidad: capitalize(mk.especialidad || esp.esDesc),
    mutuas: ["IMQ"],
    direccion: capitalize(mk.direccion),
    cp: mk.cp,
    ciudad: capitalize(mk.ciudad),
    telefono: mk.telefono,
    rating: 0,
    numReviews: 0,
  }));
}
