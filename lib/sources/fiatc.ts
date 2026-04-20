/**
 * Cliente *live* de Fiatc (`guiamedica.fiatc.es`).
 *
 * El buscador es un form GET clásico que renderiza una página SSR con el
 * listado completo de resultados embebido como JSON en una variable JS
 * (`centres = [ ... ]`) dentro de un `<script>` inline. Extraemos ese array
 * con un matcher de corchetes.
 *
 * El backend está capado a 15 items por consulta (ordenados por `prior` desc)
 * y el parámetro `pag` solo afecta a la paginación cliente-side, así que no
 * merece la pena paginar. Con CP + especialidad obtenemos hasta 15 resultados
 * relevantes (los más cercanos/prioritarios), suficiente para la ficha.
 *
 * `quadre=0` = "Cuadro completo" (cubre todos los productos Medifiatc).
 */
import { coordsFromCP, normalizeCp } from "@/lib/coordinates";
import type { Doctor } from "@/lib/types";

const BASE = "https://guiamedica.fiatc.es/resultats-cerca-medica/";

// Código INE (2 dígitos del CP) → slug usado por el form de Fiatc.
const PROV_MAP: Record<string, string> = {
  "01": "alava", "02": "albacete", "03": "alicante", "04": "almeria",
  "05": "avila", "06": "badajoz", "07": "baleares", "08": "barcelona",
  "09": "burgos", "10": "caceres", "11": "cadiz", "12": "castellon",
  "13": "ciudad-real", "14": "cordoba", "15": "la-corua", "16": "cuenca",
  "17": "girona", "18": "granada", "19": "guadalajara", "20": "guipuzcoa",
  "21": "huelva", "22": "huesca", "23": "jaen", "24": "leon",
  "25": "lleida", "26": "la-rioja", "27": "lugo", "28": "madrid",
  "29": "malaga", "30": "murcia", "31": "navarra", "32": "orense",
  "33": "asturias", "34": "palencia", "35": "las-palmas", "36": "pontevedra",
  "37": "salamanca", "38": "tenerife", "39": "cantabria", "40": "segovia",
  "41": "sevilla", "42": "soria", "43": "tarragona", "44": "teruel",
  "45": "toledo", "46": "valencia", "47": "valladolid", "48": "vizcaya",
  "49": "zamora", "50": "zaragoza", "51": "ceuta", "52": "melilla",
};

type Centre = {
  nom: string;
  nom_propi: string;
  direccio: string;
  codi_postal: string;
  lit_pob: string;
  lit_prov: string;
  telefon1: string;
  telefon2: string;
  lat: string;
  lng: string;
  lit_esp: string;
  lit_esp_url: string;
  prof: string;
  consul: string;
  ref: string;
};

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractCentres(html: string): Centre[] {
  const idx = html.indexOf("centres =");
  if (idx < 0) return [];
  const start = html.indexOf("[", idx);
  if (start < 0) return [];
  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  try {
    return JSON.parse(html.slice(start, end + 1)) as Centre[];
  } catch {
    return [];
  }
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

function firstPhone(c: Centre): string | undefined {
  for (const p of [c.telefon1, c.telefon2]) {
    const v = (p ?? "").trim();
    if (v) return v;
  }
  return undefined;
}

function centreToDoctor(c: Centre, offsetId: number): Doctor | null {
  const rawName = (c.nom ?? "").replace(/\s+/g, " ").trim();
  if (!rawName) return null;
  return {
    id: offsetId,
    nombre: normalizeText(rawName),
    especialidad: normalizeText((c.lit_esp ?? "").trim()),
    mutuas: ["Fiatc"],
    direccion: normalizeText(c.direccio ?? ""),
    cp: normalizeCp(c.codi_postal),
    ciudad: normalizeText(c.lit_pob ?? ""),
    telefono: firstPhone(c),
    rating: 0,
    numReviews: 0,
  };
}

export async function searchFiatc(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!cp || !/^\d{5}$/.test(cp) || !especialidad) return [];

  const ine = cp.slice(0, 2);
  const provinciaSlug = PROV_MAP[ine];
  if (!provinciaSlug) return [];
  // Validamos que el CP tiene coords conocidas para consistencia con el resto
  // de fuentes (aunque Fiatc ya filtra por provincia+CP sin necesitarlas).
  if (!coordsFromCP(cp)) return [];

  const especialitatSlug = toSlug(especialidad);

  const qs = new URLSearchParams({
    search_type: "1",
    codipostal: cp,
    provincia: provinciaSlug,
    provincia_id: String(parseInt(ine, 10)),
    quadre: "0",
    especialitat: especialitatSlug,
  });

  try {
    const r = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    if (!r.ok) return [];
    const html = await r.text();
    const centres = extractCentres(html);

    // IDs > 7e8 para no chocar con ningún otro fuente (MUFACE=6e8, Asisa=5e8/4e8).
    return centres
      .map((c, i) => centreToDoctor(c, 700_000_000 + i))
      .filter((d): d is Doctor => d !== null);
  } catch {
    return [];
  }
}
