/**
 * Cliente *live* de DKV Salud (`medicos.dkv.es`).
 *
 * Tras un Azure Cognitive Search expuesto públicamente: `POST
 * /semanticSearch/MedicalDirectorySelect` con body OData (`filter`, `search`,
 * `select`, `orderBy`, `skip`, `top`). Sin auth; los únicos identificadores son
 * `client-id=DKV_PUBLIC_CM` en la querystring y `clientid: 22` en headers.
 *
 * Filtramos por `SpecialityCod` (taxonomía embebida ~49 entradas) y
 * `Province` (nombre español sin acentos, tal como DKV lo guarda: 'Malaga',
 * 'Alava'...). Devuelve 1 row por centro + especialidad; hacemos dedup por
 * `SpId+AddressCod`. El campo `SpAverageRating` es string decimal 0-5 real.
 */
import type { Doctor } from "@/lib/types";

const ENDPOINT =
  "https://medicos.dkv.es/semanticSearch/MedicalDirectorySelect?client-id=DKV_PUBLIC_CM";

// Taxonomía DKV descubierta vía paginación sobre todo el índice.
// `subespecialidades` van aparte (p.ej. 9002 Ecocardiografía, 9003 Ergometría,
// 9004 Holter) — las emitimos también cuando matchean por texto.
const SPECIALITIES: Array<{ cod: number; name: string }> = [
  { cod: 1000, name: "Medicina General" },
  { cod: 2000, name: "Pediatría" },
  { cod: 3000, name: "Alergología" },
  { cod: 5000, name: "Anatomía Patológica" },
  { cod: 7000, name: "Angiología y Cirugía Vascular" },
  { cod: 8000, name: "Aparato Digestivo" },
  { cod: 9000, name: "Cardiología" },
  { cod: 11000, name: "Cirugía General y del Aparato Digestivo" },
  { cod: 12000, name: "Cirugía Oral y Máxilofacial" },
  { cod: 13000, name: "Cirugía Pediátrica" },
  { cod: 14000, name: "Cirugía Plástica y Reparadora" },
  { cod: 15000, name: "Cirugía Torácica" },
  { cod: 16000, name: "Dermatología y Venereología" },
  { cod: 18000, name: "Endocrino y Nutrición" },
  { cod: 19001, name: "Odontología General" },
  { cod: 21000, name: "Hematología y Hemoterapia" },
  { cod: 24000, name: "Medicina Interna" },
  { cod: 26000, name: "Nefrología" },
  { cod: 27000, name: "Neumología" },
  { cod: 28000, name: "Neurocirugía" },
  { cod: 29000, name: "Neurofisiología Clínica" },
  { cod: 30000, name: "Neurología" },
  { cod: 31000, name: "Ginecología y Obstetricia" },
  { cod: 32000, name: "Oftalmología" },
  { cod: 35000, name: "Otorrinolaringología" },
  { cod: 36000, name: "Psiquiatría" },
  { cod: 37000, name: "Rehabilitación" },
  { cod: 37001, name: "Fisioterapia" },
  { cod: 37002, name: "Logopedia" },
  { cod: 38000, name: "Reumatología" },
  { cod: 40000, name: "Traumatología y Ortopedia" },
  { cod: 41000, name: "Urología" },
  { cod: 50000, name: "Enfermería" },
  { cod: 53000, name: "Podología" },
  { cod: 64000, name: "Psicología" },
];

// Sinónimos UI → DKV (normalizados, sin acentos)
const SYNONYMS: Record<string, string> = {
  "andrologia": "urologia",
  "aparato digestivo": "aparato digestivo",
  "cirugia general": "cirugia general y del aparato digestivo",
  "cirugia plastica": "cirugia plastica y reparadora",
  "dermatologia": "dermatologia y venereologia",
  "endocrinologia": "endocrino y nutricion",
  "ginecologia": "ginecologia y obstetricia",
  "hematologia": "hematologia y hemoterapia",
  "medicina de urgencias": "medicina general",
  "medicina estetica": "cirugia plastica y reparadora",
  "nutricion y dieterica": "endocrino y nutricion",
  "nutricion y dietetica": "endocrino y nutricion",
  "odontologia": "odontologia general",
  "oncologia": "medicina interna",
  "traumatologia": "traumatologia y ortopedia",
};

// CP (dos primeros dígitos = código INE) → Provincia DKV
const CP_PREFIX_TO_PROVINCE: Record<string, string> = {
  "01": "Alava", "02": "Albacete", "03": "Alicante", "04": "Almería",
  "05": "Ávila", "06": "Badajoz", "07": "Islas Baleares", "08": "Barcelona",
  "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
  "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Guipuzcoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid",
  "29": "Malaga", "30": "Murcia", "31": "Navarra", "32": "Ourense",
  "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona",
  "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

type Raw = {
  SpId: number;
  AddressCod?: number;
  SpName: string;
  Address?: string;
  Road?: string;
  RoadType?: string;
  Town?: string;
  PostalCode?: number;
  Province?: string;
  Latitude?: number;
  Longitude?: number;
  SpCustomerTelephone1?: number;
  SpCustomerTelephone2?: number;
  SpAverageRating?: string;
  isCenter?: number;
  SpecialityCod?: number;
  Speciality?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSpecialityCod(especialidad: string): number | null {
  if (!especialidad) return null;
  const raw = normalize(especialidad);
  const target = SYNONYMS[raw] ?? raw;
  const exact = SPECIALITIES.find((s) => normalize(s.name) === target);
  if (exact) return exact.cod;
  const prefix = SPECIALITIES.find((s) => normalize(s.name).startsWith(target));
  if (prefix) return prefix.cod;
  const reverse = SPECIALITIES.find((s) => target.startsWith(normalize(s.name)));
  if (reverse) return reverse.cod;
  const includes = SPECIALITIES.find((s) => normalize(s.name).includes(target));
  if (includes) return includes.cod;
  return null;
}

// DKV acepta una lista limitada de nombres exactos; probamos candidatos.
function provinceCandidates(cp: string): string[] {
  const mapped = CP_PREFIX_TO_PROVINCE[cp.slice(0, 2)];
  if (!mapped) return [];
  // Variantes que DKV almacena (observadas: 'Madrid', 'Barcelona', 'Malaga',
  // 'Alava', 'Lleida', 'Las Palmas'). Probamos con y sin acento.
  const variants = new Set<string>([
    mapped,
    normalize(mapped)
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  ]);
  return [...variants];
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

function pad5(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return "";
  return String(n).padStart(5, "0");
}

function toDoctor(raw: Raw, offsetId: number, especialidadUI: string): Doctor | null {
  if (!raw.SpName) return null;
  const ratingRaw = raw.SpAverageRating ? parseFloat(raw.SpAverageRating) : 0;
  const rating = Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 10) / 10 : 0;
  const tel1 = raw.SpCustomerTelephone1 ? String(raw.SpCustomerTelephone1) : "";
  const telefono = tel1 && tel1 !== "0" ? tel1 : undefined;
  const direccion = capitalize(raw.Address || "");
  return {
    id: offsetId,
    nombre: capitalize(raw.SpName),
    especialidad: capitalize(raw.Speciality || especialidadUI),
    mutuas: ["DKV"],
    direccion,
    cp: pad5(raw.PostalCode),
    ciudad: capitalize(raw.Town || ""),
    telefono,
    rating,
    numReviews: 0,
  };
}

export async function searchDkv(cp: string, especialidad: string): Promise<Doctor[]> {
  if (!especialidad) return [];
  if (!cp || !/^\d{5}$/.test(cp)) return [];
  const cod = resolveSpecialityCod(especialidad);
  if (!cod) return [];
  const provinces = provinceCandidates(cp);
  if (provinces.length === 0) return [];

  // Intentamos con cada variante de nombre de provincia hasta obtener rows.
  let data: Array<{ Group: Raw; Count: number }> = [];
  for (const prov of provinces) {
    const filter =
      `(CompanyCod eq 1) and (Networks/any(t: search.in(t, '1')))` +
      ` and (SpecialityCod eq ${cod})` +
      ` and (Province eq '${prov.replace(/'/g, "''")}')`;
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          clientid: "22",
          lang: "es",
          canonical: "true",
          alldata: "true",
          ofuscatedocumentid: "true",
          accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify({
          count: true,
          filter,
          search: "*",
          searchMode: "all",
          select: [
            "SpId",
            "AddressCod",
            "SpName",
            "Address",
            "Town",
            "PostalCode",
            "Province",
            "Latitude",
            "Longitude",
            "SpCustomerTelephone1",
            "SpCustomerTelephone2",
            "SpAverageRating",
            "isCenter",
            "SpecialityCod",
            "Speciality",
          ],
          orderBy: ["SpAverageRating desc"],
          skip: 0,
          top: 200,
        }),
        cache: "no-store",
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: Array<{ Group: Raw; Count: number }> };
      if (j.data && j.data.length) {
        data = j.data;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!data.length) return [];

  // Dedup por SpId+AddressCod (DKV devuelve el mismo centro con distintas
  // subespecialidades como rows separadas, ya agrupadas en Group).
  const seen = new Set<string>();
  const deduped: Raw[] = [];
  for (const row of data) {
    const g = row.Group;
    const key = `${g.SpId}-${g.AddressCod ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(g);
  }

  // IDs > 7e8 para no chocar con el resto de fuentes live.
  return deduped
    .map((r, i) => toDoctor(r, 700_000_000 + i, especialidad))
    .filter((d): d is Doctor => d !== null);
}
